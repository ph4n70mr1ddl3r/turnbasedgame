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
#include <optional>
#include <nlohmann/json.hpp>
#include "hv/HttpServer.h"
#include "hv/WebSocketServer.h"

using namespace hv;
using json = nlohmann::json;

// Forward declarations
class PokerGame;
class SessionManager;

constexpr int SESSION_TIMEOUT_MINUTES = 30;
constexpr size_t MAX_RATE_LIMITER_ENTRIES = 10000;
constexpr int MAX_BET_AMOUNT = 1000000;
constexpr int RATE_LIMITER_CLEANUP_INTERVAL_MINUTES = 5;

// Get a unique identifier for a WebSocket channel.
// peeraddr() is not unique when multiple clients share the same NAT/proxy,
// so we combine peeraddr() with the channel's internal fd via its string representation.
std::string channel_id(const std::shared_ptr<WebSocketChannel>& channel) {
    // Use the channel's peeraddr plus its local fd representation for uniqueness.
    // hv::WebSocketChannel exposes fd() which gives us a unique per-connection value.
    return channel->peeraddr() + "#" + std::to_string(channel->fd());
}

std::string generate_secure_token() {
    unsigned char buf[16];
    ssize_t result = getrandom(buf, sizeof(buf), 0);
    if (result != sizeof(buf)) {
        std::cerr << "WARNING: getrandom() failed (returned " << result << "), falling back to std::random_device. "
                  << "Tokens may not be cryptographically secure." << std::endl;
        std::random_device rd;
        std::mt19937_64 gen(rd());
        std::uniform_int_distribution<uint64_t> dis;
        uint64_t val1 = dis(gen);
        uint64_t val2 = dis(gen);
        memcpy(buf, &val1, 8);
        memcpy(buf + 8, &val2, 8);
    }
    
    // Use memcpy to avoid strict aliasing violations and buffer over-reads
    uint32_t time_low;
    uint16_t time_mid;
    uint16_t time_hi;
    uint16_t clock_seq;
    uint16_t node_hi;
    uint32_t node_lo;
    memcpy(&time_low, buf, 4);
    memcpy(&time_mid, buf + 4, 2);
    memcpy(&time_hi, buf + 6, 2);
    memcpy(&clock_seq, buf + 8, 2);
    memcpy(&node_hi, buf + 10, 2);
    memcpy(&node_lo, buf + 12, 4);
    
    // UUID v4 variant
    time_hi = (time_hi & 0x0FFF) | 0x4000;
    clock_seq = (clock_seq & 0x3FFF) | 0x8000;
    
    std::stringstream ss;
    ss << std::hex << std::setfill('0');
    ss << std::setw(8) << time_low << '-';
    ss << std::setw(4) << time_mid << '-';
    ss << std::setw(4) << time_hi << '-';
    ss << std::setw(4) << clock_seq << '-';
    ss << std::setw(4) << node_hi << std::setw(8) << node_lo;
    
    return ss.str();
}

struct ClientEntry {
    std::vector<std::chrono::steady_clock::time_point> times;
    std::chrono::steady_clock::time_point last_activity;
};

class RateLimiter {
private:
    std::map<std::string, ClientEntry> entries_;
    mutable std::mutex mutex_;
    size_t max_requests_;
    std::chrono::milliseconds window_;
    size_t max_entries_;
    
public:
    RateLimiter(size_t max_requests, std::chrono::milliseconds window, size_t max_entries = MAX_RATE_LIMITER_ENTRIES)
        : max_requests_(max_requests), window_(window), max_entries_(max_entries) {}
    
    bool allow_request(const std::string& client_id) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        auto now = std::chrono::steady_clock::now();
        
        if (entries_.size() >= max_entries_) {
            // Evict least-recently-used 10% of entries (prevents DoS)
            size_t to_remove = std::max(size_t(1), max_entries_ / 10);
            // Build sorted list by last_activity
            std::vector<std::pair<std::chrono::steady_clock::time_point, std::string>> sorted;
            sorted.reserve(entries_.size());
            for (const auto& [id, entry] : entries_) {
                sorted.emplace_back(entry.last_activity, id);
            }
            std::sort(sorted.begin(), sorted.end());
            for (size_t i = 0; i < to_remove && i < sorted.size(); ++i) {
                entries_.erase(sorted[i].second);
            }
        }
        
        auto& entry = entries_[client_id];
        entry.last_activity = now;
        
        auto cutoff = now - window_;
        entry.times.erase(
            std::remove_if(entry.times.begin(), entry.times.end(),
                [cutoff](const auto& t) { return t < cutoff; }),
            entry.times.end()
        );
        
        if (entry.times.size() >= max_requests_) {
            return false;
        }
        
        entry.times.push_back(now);
        return true;
    }
    
    void cleanup_stale() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto cutoff = std::chrono::steady_clock::now() - std::chrono::minutes(RATE_LIMITER_CLEANUP_INTERVAL_MINUTES);
        for (auto it = entries_.begin(); it != entries_.end();) {
            if (it->second.times.empty() || it->second.last_activity < cutoff) {
                it = entries_.erase(it);
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
    
    bool is_expired() const noexcept {
        auto now = std::chrono::steady_clock::now();
        auto inactive_duration = std::chrono::duration_cast<std::chrono::minutes>(now - last_activity);
        return inactive_duration.count() > SESSION_TIMEOUT_MINUTES;
    }
    
    void update_activity() noexcept {
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
        bool p2_exists = false;
        for (const auto& [token, session] : sessions_) {
            if (session.player_id == "p1") p1_exists = true;
            if (session.player_id == "p2") p2_exists = true;
        }
        if (!p1_exists) return "p1";
        if (!p2_exists) return "p2";
        return "";
    }
    
public:
    struct SessionInfo {
        std::string player_id;
        std::string token;
        bool is_new;
    };
    
    std::optional<SessionInfo> get_or_create_session(std::shared_ptr<WebSocketChannel> channel) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        std::string cid = channel_id(channel);
        auto conn_it = connection_to_token_.find(cid);
        if (conn_it != connection_to_token_.end()) {
            auto sess_it = sessions_.find(conn_it->second);
            if (sess_it != sessions_.end()) {
                if (!sess_it->second.is_expired()) {
                    sess_it->second.update_activity();
                    return SessionInfo{sess_it->second.player_id, sess_it->second.token, false};
                }
                // Clean up expired session for this connection
                sessions_.erase(sess_it);
                connection_to_token_.erase(conn_it);
            }
        }
        
        // Clean up any stale connection mapping from a previous connection on same channel
        if (conn_it != connection_to_token_.end()) {
            connection_to_token_.erase(conn_it);
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
        connection_to_token_[channel_id(channel)] = token;
        
        return SessionInfo{player_id, token, true};
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
        connection_to_token_[channel_id(channel)] = token;
        
        return token;
    }
    
    Session* get_session(const std::string& token) {
        std::lock_guard<std::mutex> lock(mutex_);
        return get_session_internal(token);
    }
    
    // MUST be called with mutex_ already held
    // Note: Does NOT update activity here - only explicit operations should extend session lifetime
    Session* get_session_internal(const std::string& token) {
        auto it = sessions_.find(token);
        if (it == sessions_.end()) return nullptr;
        
        if (it->second.is_expired()) {
            if (auto conn = it->second.connection.lock()) {
                connection_to_token_.erase(channel_id(conn));
            }
            sessions_.erase(it);
            return nullptr;
        }
        
        return &it->second;
    }
    
    // Returns session info (player_id + token) by connection.
    // Returns nullopt if not found or expired. This avoids returning a raw pointer
    // that could be invalidated by another thread.
    struct SessionLookup {
        std::string player_id;
        std::string token;
    };
    std::optional<SessionLookup> lookup_session_by_connection(std::shared_ptr<WebSocketChannel> channel) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = connection_to_token_.find(channel_id(channel));
        if (it == connection_to_token_.end()) return std::nullopt;
        
        Session* session = get_session_internal(it->second);
        if (!session) return std::nullopt;
        
        return SessionLookup{session->player_id, session->token};
    }
    
    void remove_session(const std::string& token) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = sessions_.find(token);
        if (it != sessions_.end()) {
            if (auto conn = it->second.connection.lock()) {
                connection_to_token_.erase(channel_id(conn));
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
                    connection_to_token_.erase(channel_id(conn));
                }
                sessions_.erase(it);
            }
        }
    }
    
    void remove_session_by_connection(const std::string& cid) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = connection_to_token_.find(cid);
        if (it != connection_to_token_.end()) {
            sessions_.erase(it->second);
            connection_to_token_.erase(it);
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
    std::string last_action;
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
    std::string last_winner;
    std::string winning_hand;
    
    json to_json(const std::string& viewer_id = "") const {
        json j;
        j["players"] = json::array();
        for (const auto& player : players) {
            json p;
            p["player_id"] = player.id;
            p["chip_stack"] = player.chip_stack;
            // Send hole cards to the owning player, or to everyone at showdown
            bool should_reveal = (player.id == viewer_id) || (game_status == "finished");
            if (!viewer_id.empty() && should_reveal) {
                p["hole_cards"] = player.hole_cards;
            } else {
                p["hole_cards"] = std::vector<std::string>();
            }
            p["current_bet"] = player.current_bet;
            p["is_active"] = !player.is_folded;
            p["is_folded"] = player.is_folded;
            p["is_all_in"] = player.is_all_in;
            p["position"] = player.position;
            p["time_remaining"] = time_remaining;
            p["last_action"] = player.last_action;
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
        if (!last_winner.empty()) j["last_winner"] = last_winner;
        if (!winning_hand.empty()) j["winning_hand"] = winning_hand;
        
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
        // Find current player index
        int current_idx = -1;
        for (int i = 0; i < (int)state_.players.size(); ++i) {
            if (state_.players[i].id == state_.current_player) {
                current_idx = i;
                break;
            }
        }
        if (current_idx < 0) return;
        
        // Count active (non-folded, non-all-in) players
        int active_players = 0;
        for (const auto& p : state_.players) {
            if (!p.is_folded && !p.is_all_in) active_players++;
        }
        
        // If only one active player remains, no need to advance turn
        if (active_players <= 1 && state_.round != "showdown") {
            // Check if all other players are folded -> hand is over
            int non_folded = 0;
            std::string last_standing;
            for (const auto& p : state_.players) {
                if (!p.is_folded) {
                    non_folded++;
                    last_standing = p.id;
                }
            }
            if (non_folded == 1) {
                // Award pot to last standing player
                for (auto& p : state_.players) {
                    if (p.id == last_standing) {
                        p.chip_stack += state_.pot;
                        break;
                    }
                }
                state_.pot = 0;
                state_.game_status = "finished";
                state_.last_winner = last_standing;
                state_.winning_hand = "opponent folded";
                state_.round = "showdown";
                return;
            }
        }
        
        // Search for next active player after current
        for (int offset = 1; offset <= (int)state_.players.size(); ++offset) {
            int idx = (current_idx + offset) % (int)state_.players.size();
            auto& player = state_.players[idx];
            if (!player.is_folded && !player.is_all_in) {
                state_.current_player = player.id;
                return;
            }
        }
        
        // All players are folded or all-in; no valid next player
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
    
    json get_game_state(const std::string& viewer_id = "") {
        std::lock_guard<std::mutex> lock(mutex_);
        return state_.to_json(viewer_id);
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
            player->last_action = "fold";
            int active_players = 0;
            std::string winner_id;
            for (const auto& p : state_.players) {
                if (!p.is_folded) {
                    active_players++;
                    winner_id = p.id;
                }
            }
            if (active_players == 1) {
                for (auto& p : state_.players) {
                    if (p.id == winner_id) {
                        p.chip_stack += state_.pot;
                        break;
                    }
                }
                state_.pot = 0;
                state_.game_status = "finished";
                state_.last_winner = winner_id;
                state_.winning_hand = "opponent folded";
                state_.round = "showdown";
            } else {
                advance_turn();
            }
        } else if (action == "check") {
            player->last_action = "check";
            if (to_call > 0) {
                response.result = ActionResult::InvalidAmount;
                response.error_message = "Cannot check when there is a bet to call";
                return response;
            }
            advance_turn();
        } else if (action == "call") {
            player->last_action = "call";
            int call_amount = std::min(to_call, player->chip_stack);
            
            player->chip_stack -= call_amount;
            player->current_bet += call_amount;
            state_.pot += call_amount;
            
            if (player->chip_stack == 0) {
                player->is_all_in = true;
            }
            
            advance_turn();
        } else if (action == "raise") {
            player->last_action = "raise";
            if (amount <= 0 && player->chip_stack > to_call) {
                response.result = ActionResult::InvalidAmount;
                response.error_message = "Raise requires a positive amount";
                return response;
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
            player.last_action.clear();
        }
        state_.pot = 0;
        state_.community_cards.clear();
        state_.current_player = "p1";
        state_.round = "preflop";
        state_.game_status = "active";
        state_.current_highest_bet = 0;
        state_.last_winner.clear();
        state_.winning_hand.clear();
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
        if (rate_limiter) {
            rate_limiter->cleanup_stale();
        }
    }
}

void broadcast_game_state() {
    if (!session_manager || !poker_game) return;
    
    auto connections = session_manager->get_all_connections();
    for (auto& conn : connections) {
        try {
            auto session_info = session_manager->lookup_session_by_connection(conn);
            std::string viewer_id = session_info ? session_info->player_id : "";
            json response = {
                {"type", "game_state_update"},
                {"data", poker_game->get_game_state(viewer_id)}
            };
            conn->send(response.dump());
        } catch (const std::exception& e) {
            std::cerr << "Error broadcasting to connection: " << e.what() << std::endl;
        } catch (...) {
            std::cerr << "Unknown error broadcasting to connection" << std::endl;
        }
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
            auto result = session_manager->get_or_create_session(channel);
            if (!result || result->player_id.empty()) {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "game_full"},
                        {"message", "Game is full. Only two players allowed."}
                    }}
                };
                channel->send(error.dump());
                return;
            }
            std::string player_id = result->player_id;
            
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
                {"data", poker_game->get_game_state(player_id)}
            };
            channel->send(game_response.dump());
            
        } else if (type == "bet_action") {
            auto session_info = session_manager->lookup_session_by_connection(channel);
            if (!session_info) {
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
            
            if (message.contains("token") && message["token"].is_string()) {
                std::string message_token = message["token"];
                if (message_token != session_info->token) {
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
            if (data.contains("amount") && data["amount"].is_number_integer()) {
                amount = data["amount"].get<int>();
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
            
            auto result = poker_game->handle_bet_action(session_info->player_id, action, amount);
            
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
                {"message", "Invalid JSON format"}
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
    
    http.document_root = "../client/out";
    http.staticDirs["/"] = "../client/out";
    
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
        std::cout << "WebSocket connection closed: " << channel_id(channel) << std::endl;
        session_manager->remove_session_by_connection(channel_id(channel));
    };
    
    WebSocketServer server;
    server.registerWebSocketService(&ws);
    server.registerHttpService(&http);
    server.setPort(8080);
    server.setThreadNum(4);
    
    server_running = true;
    std::thread cleanup_thread(cleanup_thread_func);
    // Note: cleanup_thread is intentionally detached. It checks server_running
    // periodically and will exit when server_running becomes false.
    cleanup_thread.detach();
    
    std::cout << "Poker server starting on port 8080..." << std::endl;
    std::cout << "HTTP server serving static files from ../client/out" << std::endl;
    std::cout << "WebSocket server ready for connections" << std::endl;
    
    server.run();
    
    server_running = false;
    
    // Graceful shutdown: clean up global state
    poker_game.reset();
    session_manager.reset();
    rate_limiter.reset();
    
    std::cout << "Server shutdown complete." << std::endl;
    
    return 0;
}
