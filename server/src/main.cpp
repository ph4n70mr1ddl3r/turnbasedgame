#include <iostream>
#include <string>
#include <map>
#include <memory>
#include <random>
#include <chrono>
#include <mutex>
#include <thread>
#include <atomic>
#include <vector>
#include <algorithm>
#include <sstream>
#include <iomanip>
#include <csignal>
#include <cstring>
#include <unistd.h>
#include <sys/random.h>
#include <nlohmann/json.hpp>
#include "hv/HttpServer.h"
#include "hv/WebSocketServer.h"

using namespace hv;
using json = nlohmann::json;

constexpr int SESSION_TIMEOUT_MINUTES = 30;
constexpr size_t MAX_RATE_LIMITER_ENTRIES = 10000;
constexpr int MAX_BET_AMOUNT = 1000000;
constexpr int RATE_LIMITER_CLEANUP_INTERVAL_MINUTES = 5;

// Forward declarations
class PokerGame;
class SessionManager;

std::string generate_secure_token() {
    unsigned char buf[16];
    ssize_t result = getrandom(buf, sizeof(buf), 0);
    if (result != sizeof(buf)) {
        std::random_device rd;
        std::mt19937_64 gen(rd());
        std::uniform_int_distribution<uint64_t> dis;
        uint64_t val1 = dis(gen);
        uint64_t val2 = dis(gen);
        memcpy(buf, &val1, 8);
        memcpy(buf + 8, &val2, 8);
    }
    
    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    
    ss << std::setw(8) << (*reinterpret_cast<uint32_t*>(buf) & 0xFFFFFFFF);
    ss << '-';
    ss << std::setw(4) << (*reinterpret_cast<uint16_t*>(buf + 4) & 0xFFFF);
    ss << '-';
    ss << std::setw(4) << ((*reinterpret_cast<uint16_t*>(buf + 6) & 0x0FFF) | 0x4000);
    ss << '-';
    ss << std::setw(4) << ((*reinterpret_cast<uint16_t*>(buf + 8) & 0x3FFF) | 0x8000);
    ss << '-';
    ss << std::setw(12) << (*reinterpret_cast<uint64_t*>(buf + 10) & 0xFFFFFFFFFFFF);
    
    return ss.str();
}

class RateLimiter {
private:
    std::map<std::string, std::vector<std::chrono::steady_clock::time_point>> request_times_;
    mutable std::mutex mutex_;
    size_t max_requests_;
    std::chrono::milliseconds window_;
    size_t max_entries_;
    
public:
    RateLimiter(size_t max_requests, std::chrono::milliseconds window, size_t max_entries = MAX_RATE_LIMITER_ENTRIES)
        : max_requests_(max_requests), window_(window), max_entries_(max_entries) {}
    
    bool allow_request(const std::string& client_id) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (request_times_.size() >= max_entries_) {
            request_times_.clear();
        }
        
        auto now = std::chrono::steady_clock::now();
        auto& times = request_times_[client_id];
        
        auto cutoff = now - window_;
        times.erase(
            std::remove_if(times.begin(), times.end(),
                [cutoff](const auto& t) { return t < cutoff; }),
            times.end()
        );
        
        if (times.size() >= max_requests_) {
            return false;
        }
        
        times.push_back(now);
        return true;
    }
    
    void cleanup_stale() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto cutoff = std::chrono::steady_clock::now() - std::chrono::minutes(RATE_LIMITER_CLEANUP_INTERVAL_MINUTES);
        for (auto it = request_times_.begin(); it != request_times_.end();) {
            if (it->second.empty() || it->second.back() < cutoff) {
                it = request_times_.erase(it);
            } else {
                ++it;
            }
        }
    }
};

struct Session {
    std::string token;
    std::string player_id;
    std::chrono::steady_clock::time_point created_at;
    std::chrono::steady_clock::time_point last_activity;
    std::weak_ptr<WebSocketChannel> connection;
    
    bool is_expired() const {
        auto now = std::chrono::steady_clock::now();
        auto inactive_duration = std::chrono::duration_cast<std::chrono::minutes>(now - last_activity);
        return inactive_duration.count() > SESSION_TIMEOUT_MINUTES;
    }
    
    void update_activity() {
        last_activity = std::chrono::steady_clock::now();
    }
};

class SessionManager {
private:
    std::map<std::string, Session> sessions_;
    std::map<std::string, std::string> connection_to_token_;
    mutable std::mutex mutex_;
    
    std::string determine_available_player_id_locked() {
        bool p1_exists = false;
        for (const auto& [token, session] : sessions_) {
            if (session.player_id == "p1") {
                p1_exists = true;
                break;
            }
        }
        return p1_exists ? "p2" : "p1";
    }
    
public:
    std::pair<Session*, bool> get_or_create_session(std::shared_ptr<WebSocketChannel> channel) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        auto conn_it = connection_to_token_.find(channel->peeraddr());
        if (conn_it != connection_to_token_.end()) {
            auto sess_it = sessions_.find(conn_it->second);
            if (sess_it != sessions_.end()) {
                if (!sess_it->second.is_expired()) {
                    sess_it->second.update_activity();
                    return {&sess_it->second, false};
                }
            }
        }
        
        std::string player_id = determine_available_player_id_locked();
        std::string token = generate_secure_token();
        
        Session session{
            .token = token,
            .player_id = player_id,
            .created_at = std::chrono::steady_clock::now(),
            .last_activity = std::chrono::steady_clock::now(),
            .connection = channel
        };
        
        sessions_[token] = session;
        connection_to_token_[channel->peeraddr()] = token;
        
        return {&sessions_[token], true};
    }
    
    std::string create_session(const std::string& player_id, std::shared_ptr<WebSocketChannel> channel) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        std::string token = generate_secure_token();
        
        Session session{
            .token = token,
            .player_id = player_id,
            .created_at = std::chrono::steady_clock::now(),
            .last_activity = std::chrono::steady_clock::now(),
            .connection = channel
        };
        
        sessions_[token] = session;
        connection_to_token_[channel->peeraddr()] = token;
        
        return token;
    }
    
    Session* get_session(const std::string& token) {
        std::lock_guard<std::mutex> lock(mutex_);
        return get_session_internal(token);
    }
    
    Session* get_session_internal(const std::string& token) {
        auto it = sessions_.find(token);
        if (it == sessions_.end()) return nullptr;
        
        if (it->second.is_expired()) {
            if (auto conn = it->second.connection.lock()) {
                connection_to_token_.erase(conn->peeraddr());
            }
            sessions_.erase(it);
            return nullptr;
        }
        
        it->second.update_activity();
        return &it->second;
    }
    
    Session* get_session_by_connection(std::shared_ptr<WebSocketChannel> channel) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = connection_to_token_.find(channel->peeraddr());
        if (it == connection_to_token_.end()) return nullptr;
        
        return get_session_internal(it->second);
    }
    
    void remove_session(const std::string& token) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = sessions_.find(token);
        if (it != sessions_.end()) {
            if (auto conn = it->second.connection.lock()) {
                connection_to_token_.erase(conn->peeraddr());
            }
            sessions_.erase(it);
        }
    }
    
    void cleanup_expired() {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<std::string> expired_tokens;
        for (const auto& [token, session] : sessions_) {
            if (session.is_expired()) {
                expired_tokens.push_back(token);
            }
        }
        
        for (const auto& token : expired_tokens) {
            auto it = sessions_.find(token);
            if (it != sessions_.end()) {
                if (auto conn = it->second.connection.lock()) {
                    connection_to_token_.erase(conn->peeraddr());
                }
                sessions_.erase(it);
            }
        }
    }
    
    std::vector<std::shared_ptr<WebSocketChannel>> get_all_connections() {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<std::shared_ptr<WebSocketChannel>> connections;
        for (const auto& [token, session] : sessions_) {
            if (auto conn = session.connection.lock()) {
                connections.push_back(conn);
            }
        }
        return connections;
    }
};

struct Player {
    std::string id;
    int chip_stack = 1500;
    std::vector<std::string> hole_cards;
    int current_bet = 0;
    bool is_folded = false;
    bool is_all_in = false;
    std::string position = "none";
};

struct PokerGameState {
    std::vector<Player> players;
    std::vector<std::string> community_cards;
    int pot = 0;
    std::string current_player;
    int time_remaining = 30000;
    std::string round = "preflop";
    int min_bet = 50;
    int max_bet = 1500;
    std::string game_status = "waiting";
    int current_highest_bet = 0;
    
    json to_json() const {
        json j;
        j["players"] = json::array();
        for (const auto& player : players) {
            json p;
            p["player_id"] = player.id;
            p["chip_stack"] = player.chip_stack;
            p["hole_cards"] = player.hole_cards;
            p["current_bet"] = player.current_bet;
            p["is_active"] = !player.is_folded;
            p["is_folded"] = player.is_folded;
            p["is_all_in"] = player.is_all_in;
            p["position"] = player.position;
            p["time_remaining"] = 30000;
            j["players"].push_back(p);
        }
        
        j["community_cards"] = community_cards;
        j["pot"] = pot;
        j["current_player"] = current_player;
        j["time_remaining"] = time_remaining;
        j["round"] = round;
        j["min_bet"] = min_bet;
        j["max_bet"] = max_bet;
        j["game_status"] = game_status;
        
        return j;
    }
};

class PokerGame {
private:
    PokerGameState state_;
    SessionManager& session_manager_;
    mutable std::mutex mutex_;
    
    Player* get_player(const std::string& player_id) {
        for (auto& player : state_.players) {
            if (player.id == player_id) return &player;
        }
        return nullptr;
    }
    
    void advance_turn() {
        for (auto& player : state_.players) {
            if (player.id != state_.current_player && !player.is_folded && !player.is_all_in) {
                state_.current_player = player.id;
                return;
            }
        }
    }
    
public:
    PokerGame(SessionManager& sm) : session_manager_(sm) {
        std::lock_guard<std::mutex> lock(mutex_);
        Player p1{"p1", 1500};
        Player p2{"p2", 1500};
        
        p1.position = "button";
        p2.position = "big_blind";
        
        state_.players = {p1, p2};
        state_.current_player = "p1";
        state_.game_status = "active";
        state_.current_highest_bet = 0;
    }
    
    PokerGameState get_state() {
        std::lock_guard<std::mutex> lock(mutex_);
        return state_;
    }
    
    json get_game_state() {
        std::lock_guard<std::mutex> lock(mutex_);
        return state_.to_json();
    }
    
    enum class ActionResult {
        Success,
        InvalidPlayer,
        NotYourTurn,
        InsufficientChips,
        InvalidAmount,
        PlayerFolded,
        PlayerAllIn
    };
    
    struct ActionResponse {
        ActionResult result;
        json new_state;
        std::string error_message;
    };
    
    ActionResponse handle_bet_action(const std::string& player_id, const std::string& action, int amount = 0) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        ActionResponse response;
        
        Player* player = get_player(player_id);
        if (!player) {
            response.result = ActionResult::InvalidPlayer;
            response.error_message = "Invalid player ID";
            return response;
        }
        
        if (state_.current_player != player_id) {
            response.result = ActionResult::NotYourTurn;
            response.error_message = "Not your turn";
            return response;
        }
        
        if (player->is_folded) {
            response.result = ActionResult::PlayerFolded;
            response.error_message = "Player has already folded";
            return response;
        }
        
        if (player->is_all_in && action != "fold") {
            response.result = ActionResult::PlayerAllIn;
            response.error_message = "Player is already all-in";
            return response;
        }
        
        int to_call = state_.current_highest_bet - player->current_bet;
        
        if (action == "fold") {
            player->is_folded = true;
            advance_turn();
        } else if (action == "check") {
            if (to_call > 0) {
                response.result = ActionResult::InvalidAmount;
                response.error_message = "Cannot check when there is a bet to call";
                return response;
            }
            advance_turn();
        } else if (action == "call") {
            int call_amount = std::min(to_call, player->chip_stack);
            
            player->chip_stack -= call_amount;
            player->current_bet += call_amount;
            state_.pot += call_amount;
            
            if (player->chip_stack == 0) {
                player->is_all_in = true;
            }
            
            advance_turn();
        } else if (action == "raise") {
            if (amount < state_.min_bet) {
                amount = state_.min_bet;
            }
            
            int total_raise = to_call + amount;
            
            if (total_raise > player->chip_stack) {
                total_raise = player->chip_stack;
                amount = total_raise - to_call;
            }
            
            if (amount < state_.min_bet && player->chip_stack > to_call) {
                response.result = ActionResult::InvalidAmount;
                response.error_message = "Raise amount must be at least min_bet";
                return response;
            }
            
            player->chip_stack -= total_raise;
            player->current_bet += total_raise;
            state_.pot += total_raise;
            state_.current_highest_bet = player->current_bet;
            
            if (player->chip_stack == 0) {
                player->is_all_in = true;
            }
            
            advance_turn();
        } else {
            response.result = ActionResult::InvalidAmount;
            response.error_message = "Unknown action: " + action;
            return response;
        }
        
        response.result = ActionResult::Success;
        response.new_state = state_.to_json();
        return response;
    }
    
    void reset_game() {
        std::lock_guard<std::mutex> lock(mutex_);
        for (auto& player : state_.players) {
            player.chip_stack = 1500;
            player.current_bet = 0;
            player.is_folded = false;
            player.is_all_in = false;
            player.hole_cards.clear();
        }
        state_.pot = 0;
        state_.community_cards.clear();
        state_.current_player = "p1";
        state_.round = "preflop";
        state_.game_status = "active";
        state_.current_highest_bet = 0;
    }
};

std::unique_ptr<SessionManager> session_manager;
std::unique_ptr<PokerGame> poker_game;
std::unique_ptr<RateLimiter> rate_limiter;
std::atomic<bool> server_running(false);

void cleanup_thread_func() {
    while (server_running) {
        std::this_thread::sleep_for(std::chrono::minutes(5));
        if (session_manager) {
            session_manager->cleanup_expired();
        }
    }
}

void broadcast_game_state() {
    if (!session_manager || !poker_game) return;
    
    json response = {
        {"type", "game_state_update"},
        {"data", poker_game->get_game_state()}
    };
    
    auto connections = session_manager->get_all_connections();
    for (auto& conn : connections) {
        conn->send(response.dump());
    }
}

constexpr size_t MAX_MESSAGE_SIZE = 64 * 1024;

void handle_websocket_message(std::shared_ptr<WebSocketChannel> channel, const std::string& msg) {
    std::string client_id = channel->peeraddr();
    
    if (!rate_limiter->allow_request(client_id)) {
        json error = {
            {"type", "error"},
            {"data", {
                {"code", "rate_limited"},
                {"message", "Too many requests. Please slow down."}
            }}
        };
        channel->send(error.dump());
        return;
    }
    
    if (msg.size() > MAX_MESSAGE_SIZE) {
        json error = {
            {"type", "error"},
            {"data", {
                {"code", "message_too_large"},
                {"message", "Message exceeds maximum size limit"}
            }}
        };
        channel->send(error.dump());
        return;
    }

    try {
        json message = json::parse(msg);
        
        if (!message.contains("type") || !message["type"].is_string()) {
            json error = {
                {"type", "error"},
                {"data", {
                    {"code", "invalid_message"},
                    {"message", "Message must have a 'type' field"}
                }}
            };
            channel->send(error.dump());
            return;
        }
        
        std::string type = message["type"];
        
        if (type == "session_init") {
            auto [session, created] = session_manager->get_or_create_session(channel);
            std::string player_id = session->player_id;
            
            json response = {
                {"type", "connection_status"},
                {"data", {
                    {"status", "connected"},
                    {"player_id", player_id}
                }}
            };
            channel->send(response.dump());
            
            json game_response = {
                {"type", "game_state_update"},
                {"data", poker_game->get_game_state()}
            };
            channel->send(game_response.dump());
            
        } else if (type == "bet_action") {
            Session* session = session_manager->get_session_by_connection(channel);
            if (!session) {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "invalid_token"},
                        {"message", "Invalid or expired session"}
                    }}
                };
                channel->send(error.dump());
                return;
            }
            
            if (!message.contains("data") || !message["data"].is_object()) {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "invalid_message"},
                        {"message", "Missing 'data' field"}
                    }}
                };
                channel->send(error.dump());
                return;
            }
            
            auto data = message["data"];
            
            if (data.contains("token") && data["token"].is_string()) {
                std::string message_token = data["token"];
                if (message_token != session->token) {
                    json error = {
                        {"type", "error"},
                        {"data", {
                            {"code", "invalid_token"},
                            {"message", "Token mismatch"}
                        }}
                    };
                    channel->send(error.dump());
                    return;
                }
            }
            
            if (!data.contains("action") || !data["action"].is_string()) {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "invalid_action"},
                        {"message", "Missing 'action' field"}
                    }}
                };
                channel->send(error.dump());
                return;
            }
            
            std::string action = data["action"];
            int amount = 0;
            if (data.contains("amount") && data["amount"].is_number()) {
                amount = data["amount"];
                if (amount < 0) {
                    json error = {
                        {"type", "error"},
                        {"data", {
                            {"code", "invalid_amount"},
                            {"message", "Amount must be non-negative"}
                        }}
                    };
                    channel->send(error.dump());
                    return;
                }
                if (amount > MAX_BET_AMOUNT) {
                    json error = {
                        {"type", "error"},
                        {"data", {
                            {"code", "invalid_amount"},
                            {"message", "Amount exceeds maximum allowed bet"}
                        }}
                    };
                    channel->send(error.dump());
                    return;
                }
            }
            
            auto result = poker_game->handle_bet_action(session->player_id, action, amount);
            
            if (result.result == PokerGame::ActionResult::Success) {
                broadcast_game_state();
            } else {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "action_failed"},
                        {"message", result.error_message}
                    }}
                };
                channel->send(error.dump());
            }
            
        } else if (type == "heartbeat") {
            uint64_t timestamp = 0;
            if (message.contains("data") && message["data"].is_object() && 
                message["data"].contains("timestamp") && message["data"]["timestamp"].is_number()) {
                timestamp = message["data"]["timestamp"];
            }
            
            json response = {
                {"type", "heartbeat"},
                {"data", {
                    {"timestamp", timestamp}
                }}
            };
            channel->send(response.dump());
            
        } else {
            json error = {
                {"type", "error"},
                {"data", {
                    {"code", "unknown_message_type"},
                    {"message", "Unknown message type: " + type}
                }}
            };
            channel->send(error.dump());
        }
        
    } catch (const json::parse_error& e) {
        json error = {
            {"type", "error"},
            {"data", {
                {"code", "parse_error"},
                {"message", "Invalid JSON: " + std::string(e.what())}
            }}
        };
        channel->send(error.dump());
    } catch (const std::exception& e) {
        std::cerr << "Internal server error: " << e.what() << std::endl;
        json error = {
            {"type", "error"},
            {"data", {
                {"code", "server_error"},
                {"message", "An internal error occurred"}
            }}
        };
        channel->send(error.dump());
    }
}

int main() {
    session_manager = std::make_unique<SessionManager>();
    poker_game = std::make_unique<PokerGame>(*session_manager);
    rate_limiter = std::make_unique<RateLimiter>(100, std::chrono::milliseconds(60000));
    
    std::signal(SIGTERM, [](int) {
        std::cout << "\nReceived SIGTERM, shutting down gracefully..." << std::endl;
        server_running = false;
    });
    
    std::signal(SIGINT, [](int) {
        std::cout << "\nReceived SIGINT, shutting down gracefully..." << std::endl;
        server_running = false;
    });
    
    HttpService http;
    WebSocketService ws;
    
    http.static("/", "../client/out");
    
    ws.onopen = [](const WebSocketChannelPtr& channel, const HttpRequestPtr& req) {
        std::cout << "WebSocket connection opened: " << req->path << std::endl;
        
        json status_msg = {
            {"type", "connection_status"},
            {"data", {
                {"status", "connected"},
                {"message", "Welcome to poker game"}
            }}
        };
        channel->send(status_msg.dump());
    };
    
    ws.onmessage = [](const WebSocketChannelPtr& channel, const std::string& msg) {
        handle_websocket_message(channel, msg);
    };
    
    ws.onclose = [](const WebSocketChannelPtr& channel) {
        std::cout << "WebSocket connection closed: " << channel->peeraddr() << std::endl;
        session_manager->cleanup_expired();
    };
    
    WebSocketServer server(&ws);
    server.registerHttpService(&http);
    server.setPort(8080);
    server.setThreadNum(4);
    
    server_running = true;
    std::thread cleanup_thread(cleanup_thread_func);
    
    std::cout << "Poker server starting on port 8080..." << std::endl;
    std::cout << "HTTP server serving static files from ../client/out" << std::endl;
    std::cout << "WebSocket server ready for connections" << std::endl;
    
    server.run();
    
    server_running = false;
    if (cleanup_thread.joinable()) {
        cleanup_thread.join();
    }
    
    return 0;
}
