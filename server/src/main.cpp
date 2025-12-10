#include <iostream>
#include <string>
#include <map>
#include <memory>
#include <random>
#include <chrono>
#include <nlohmann/json.hpp>
#include "hv/HttpServer.h"
#include "hv/WebSocketServer.h"

using namespace hv;
using json = nlohmann::json;

// Forward declarations
class PokerGame;
class SessionManager;

// Session data
struct Session {
    std::string token;
    std::string player_id;
    std::chrono::steady_clock::time_point created_at;
    std::chrono::steady_clock::time_point last_activity;
    std::weak_ptr<WebSocketChannel> connection;
    
    bool is_expired() const {
        auto now = std::chrono::steady_clock::now();
        auto inactive_duration = std::chrono::duration_cast<std::chrono::minutes>(now - last_activity);
        return inactive_duration.count() > 30; // 30 minute expiry
    }
    
    void update_activity() {
        last_activity = std::chrono::steady_clock::now();
    }
};

// Session manager
class SessionManager {
private:
    std::map<std::string, Session> sessions_;
    std::map<std::string, std::string> connection_to_token_; // WebSocket channel pointer to token
    
public:
    std::string create_session(const std::string& player_id, std::shared_ptr<WebSocketChannel> channel) {
        // Generate random token (in production, use proper UUID)
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<> dis(0, 15);
        const char* hex_chars = "0123456789abcdef";
        
        std::string token = "session_";
        for (int i = 0; i < 16; ++i) {
            token += hex_chars[dis(gen)];
        }
        
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
        auto it = sessions_.find(token);
        if (it == sessions_.end()) return nullptr;
        
        if (it->second.is_expired()) {
            sessions_.erase(it);
            return nullptr;
        }
        
        it->second.update_activity();
        return &it->second;
    }
    
    Session* get_session_by_connection(std::shared_ptr<WebSocketChannel> channel) {
        auto it = connection_to_token_.find(channel->peeraddr());
        if (it == connection_to_token_.end()) return nullptr;
        
        return get_session(it->second);
    }
    
    void remove_session(const std::string& token) {
        auto it = sessions_.find(token);
        if (it != sessions_.end()) {
            // Remove from connection map
            if (auto conn = it->second.connection.lock()) {
                connection_to_token_.erase(conn->peeraddr());
            }
            sessions_.erase(it);
        }
    }
    
    void cleanup_expired() {
        std::vector<std::string> expired_tokens;
        for (const auto& [token, session] : sessions_) {
            if (session.is_expired()) {
                expired_tokens.push_back(token);
            }
        }
        
        for (const auto& token : expired_tokens) {
            remove_session(token);
        }
    }
};

// Simple poker game state
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
            p["time_remaining"] = 30000; // Fixed for now
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

// Poker game manager
class PokerGame {
private:
    PokerGameState state_;
    SessionManager& session_manager_;
    
public:
    PokerGame(SessionManager& sm) : session_manager_(sm) {
        // Initialize two players
        Player p1{"p1", 1500};
        Player p2{"p2", 1500};
        
        // Set positions
        p1.position = "button";
        p2.position = "big_blind";
        
        state_.players = {p1, p2};
        state_.current_player = "p1";
        state_.game_status = "active";
    }
    
    PokerGameState& get_state() { return state_; }
    
    json handle_bet_action(const std::string& player_id, const std::string& action, int amount = 0) {
        // Simple bet handling for now
        auto& player = (player_id == "p1") ? state_.players[0] : state_.players[1];
        
        if (action == "fold") {
            player.is_folded = true;
            // Switch to other player (game would end if both folded, but simplified)
            state_.current_player = (player_id == "p1") ? "p2" : "p1";
        } else if (action == "check") {
            // Just switch player
            state_.current_player = (player_id == "p1") ? "p2" : "p1";
        } else if (action == "call") {
            // Match current bet (simplified)
            player.chip_stack -= 50; // Fixed call amount for demo
            state_.pot += 50;
            state_.current_player = (player_id == "p1") ? "p2" : "p1";
        } else if (action == "raise") {
            // Raise amount
            amount = std::max(state_.min_bet, std::min(amount, player.chip_stack));
            player.chip_stack -= amount;
            state_.pot += amount;
            state_.current_player = (player_id == "p1") ? "p2" : "p1";
        }
        
        return state_.to_json();
    }
    
    json get_game_state() {
        return state_.to_json();
    }
};

// Global instances (in real app, use dependency injection)
SessionManager session_manager;
PokerGame poker_game(session_manager);

// WebSocket message handler
void handle_websocket_message(std::shared_ptr<WebSocketChannel> channel, const std::string& msg) {
    try {
        json message = json::parse(msg);
        
        // Validate message structure
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
            // Create or restore session
            Session* session = session_manager.get_session_by_connection(channel);
            std::string player_id = "p1"; // Simplified: first connection gets p1
            
            if (!session) {
                std::string token = session_manager.create_session(player_id, channel);
                session = session_manager.get_session(token);
            }
            
            // Send game state
            json response = {
                {"type", "game_state_update"},
                {"data", poker_game.get_game_state()}
            };
            channel->send(response.dump());
            
        } else if (type == "bet_action") {
            // Validate session
            Session* session = session_manager.get_session_by_connection(channel);
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
            
            // Validate bet action data
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
            }
            
            // Process bet action
            json new_state = poker_game.handle_bet_action(session->player_id, action, amount);
            
            // Send updated game state to all connected clients
            json response = {
                {"type", "game_state_update"},
                {"data", new_state}
            };
            
            // Broadcast to all connections (simplified - would need connection manager)
            channel->send(response.dump());
            
        } else if (type == "heartbeat") {
            // Respond with heartbeat echo
            json response = {
                {"type", "heartbeat"},
                {"data", {
                    {"timestamp", std::chrono::duration_cast<std::chrono::milliseconds>(
                        std::chrono::system_clock::now().time_since_epoch()
                    ).count()}
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
        json error = {
            {"type", "error"},
            {"data", {
                {"code", "server_error"},
                {"message", "Internal server error: " + std::string(e.what())}
            }}
        };
        channel->send(error.dump());
    }
}

int main() {
    // Combined HTTP + WebSocket server
    HttpService http;
    WebSocketService ws;
    
    // HTTP: Serve static files from ../client/out
    http.static("/", "../client/out");
    
    // WebSocket event handlers
    ws.onopen = [](const WebSocketChannelPtr& channel, const HttpRequestPtr& req) {
        std::cout << "WebSocket connection opened: " << req->path << std::endl;
        
        // Send connection status
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
        
        // Clean up session
        session_manager.cleanup_expired();
    };
    
    // Create combined server
    WebSocketServer server(&ws);
    server.registerHttpService(&http);
    server.setPort(8080);
    server.setThreadNum(4);
    
    std::cout << "Poker server starting on port 8080..." << std::endl;
    std::cout << "HTTP server serving static files from ../client/out" << std::endl;
    std::cout << "WebSocket server ready for connections" << std::endl;
    
    server.run();
    
    return 0;
}