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
#include <set>
#include <nlohmann/json.hpp>
#include "hv/HttpServer.h"
#include "hv/WebSocketServer.h"

using namespace hv;
using json = nlohmann::json;

// Forward declarations
class PokerGame;
class SessionManager;

constexpr int SESSION_TIMEOUT_MINUTES = 30;
constexpr size_t MAX_RATE_LIMITER_ENTRIES = 100;
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
        // First clean up expired sessions so they don't block new player slots
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
        connection_to_token_.erase(cid);

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

        // Keep session alive while connection is active
        session->update_activity();
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

// ---------------------------------------------------------------------------
// Deck — standard 52-card deck with Fisher-Yates shuffle
// ---------------------------------------------------------------------------

class Deck {
private:
    std::vector<std::string> cards_;
    size_t index_ = 0;

    static std::vector<std::string> createFullDeck() {
        const char ranks[] = "23456789TJQKA";
        const char suits[] = "cdhs";
        std::vector<std::string> deck;
        deck.reserve(52);
        for (const char* s = suits; *s; ++s) {
            for (const char* r = ranks; *r; ++r) {
                deck.emplace_back(std::string{ *r, *s });
            }
        }
        return deck;
    }

    // Fisher-Yates shuffle using OS-provided randomness
    void shuffle() {
        std::random_device rd;
        std::mt19937_64 gen(rd());
        for (size_t i = cards_.size() - 1; i > 0; --i) {
            std::uniform_int_distribution<size_t> dist(0, i);
            size_t j = dist(gen);
            std::swap(cards_[i], cards_[j]);
        }
        index_ = 0;
    }

public:
    Deck() { reset(); }

    void reset() {
        cards_ = createFullDeck();
        shuffle();
    }

    // Deal one card. Throws if deck is exhausted (should never happen in hold'em).
    std::string deal() {
        if (index_ >= cards_.size()) {
            throw std::runtime_error("Deck exhausted");
        }
        return cards_[index_++];
    }

    // Deal multiple cards at once.
    std::vector<std::string> deal(size_t count) {
        std::vector<std::string> result;
        result.reserve(count);
        for (size_t i = 0; i < count; ++i) {
            result.push_back(deal());
        }
        return result;
    }

    size_t remaining() const { return cards_.size() - index_; }
};

// ---------------------------------------------------------------------------
// Hand evaluation (simplified — ranks high-card to straight-flush)
// ---------------------------------------------------------------------------

struct HandRank {
    int category;  // 8=straight-flush, 7=four-of-a-kind, ..., 0=high-card
    std::vector<int> kickers;  // Tiebreaker values in descending priority
    std::string name;
};

static int cardRankValue(char r) {
    switch (r) {
        case '2': return 2;  case '3': return 3;  case '4': return 4;
        case '5': return 5;  case '6': return 6;  case '7': return 7;
        case '8': return 8;  case '9': return 9;  case 'T': return 10;
        case 'J': return 11; case 'Q': return 12; case 'K': return 13;
        case 'A': return 14;
        default: return 0;
    }
}

// Evaluate the best 5-card hand from up to 7 cards (hole + community).
// Uses brute-force combination check — acceptable for a 2-player game.
static HandRank evaluateHand(const std::vector<std::string>& holeCards,
                              const std::vector<std::string>& communityCards) {
    std::vector<std::string> all = holeCards;
    all.insert(all.end(), communityCards.begin(), communityCards.end());

    // Parse cards into (rank_value, suit_char)
    struct Card { int rank; char suit; };
    std::vector<Card> parsed;
    parsed.reserve(all.size());
    for (const auto& c : all) {
        if (c.size() >= 2) parsed.push_back({ cardRankValue(c[0]), c[1] });
    }

    if (parsed.size() < 5) {
        // Not enough cards — return high-card rank with what we have
        std::vector<int> ranks;
        for (const auto& p : parsed) ranks.push_back(p.rank);
        std::sort(ranks.rbegin(), ranks.rend());
        return { 0, ranks, "High Card" };
    }

    // Safety: bitmask approach requires n <= 31 to avoid int overflow;
    // hold'em has 2 hole + 5 community = 7 max
    if (parsed.size() > 31) {
        return { 0, {}, "Invalid" };
    }

    // Generate all C(n,5) combinations
    int n = static_cast<int>(parsed.size());
    HandRank best{ -1, {}, "" };

    auto eval5 = [](const std::vector<Card>& hand) -> HandRank {
        std::vector<int> ranks;
        for (const auto& c : hand) ranks.push_back(c.rank);
        std::sort(ranks.rbegin(), ranks.rend());

        bool flush = true;
        char suit = hand[0].suit;
        for (const auto& c : hand) if (c.suit != suit) flush = false;

        bool straight = false;
        int straightHigh = 0;
        if (ranks[0] - ranks[4] == 4 && std::set<int>(ranks.begin(), ranks.end()).size() == 5) {
            straight = true;
            straightHigh = ranks[0];
        }
        // Ace-low straight (A-2-3-4-5)
        if (ranks[0] == 14 && ranks[1] == 5 && ranks[2] == 4 && ranks[3] == 3 && ranks[4] == 2) {
            straight = true;
            straightHigh = 5;
        }

        // Count rank frequencies
        std::map<int, int> freq;
        for (int r : ranks) freq[r]++;
        std::vector<std::pair<int, int>> freqVec(freq.begin(), freq.end());
        std::sort(freqVec.begin(), freqVec.end(), [](auto& a, auto& b) {
            return a.second > b.second || (a.second == b.second && a.first > b.first);
        });

        std::vector<int> kickers;
        for (auto& [r, _] : freqVec) kickers.push_back(r);

        if (straight && flush) return { 8, { straightHigh }, "Straight Flush" };
        if (freqVec[0].second == 4) return { 7, kickers, "Four of a Kind" };
        if (freqVec[0].second == 3 && freqVec.size() >= 2 && freqVec[1].second == 2)
            return { 6, kickers, "Full House" };
        if (flush) return { 5, ranks, "Flush" };
        if (straight) return { 4, { straightHigh }, "Straight" };
        if (freqVec[0].second == 3) return { 3, kickers, "Three of a Kind" };
        if (freqVec[0].second == 2 && freqVec.size() >= 2 && freqVec[1].second == 2)
            return { 2, kickers, "Two Pair" };
        if (freqVec[0].second == 2) return { 1, kickers, "Pair" };
        return { 0, ranks, "High Card" };
    };

    // Iterate all C(n,5) using bitmask approach
    std::vector<Card> combo(5);
    for (int mask = 0; mask < (1 << n); ++mask) {
        if (__builtin_popcount(mask) != 5) continue;
        int idx = 0;
        for (int i = 0; i < n && idx < 5; ++i) {
            if (mask & (1 << i)) combo[idx++] = parsed[i];
        }
        HandRank hr = eval5(combo);
        if (hr.category > best.category ||
            (hr.category == best.category && hr.kickers > best.kickers)) {
            best = hr;
        }
    }

    return best;
}

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
    int hand_number = 0;

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
            // Only the current player has time remaining ticking
            bool is_current = (player.id == current_player);
            p["time_remaining"] = is_current ? time_remaining : 0;
            p["last_action"] = player.last_action;
            j["players"].push_back(p);
        }

        j["community_cards"] = community_cards;
        j["pot"] = pot;
        j["current_player"] = current_player;
        j["time_remaining"] = time_remaining;
        j["round"] = round;
        j["min_bet"] = min_bet;
        // max_bet reflects the current player's remaining stack
        // so the client always shows correct raise bounds
        int effective_max_bet = max_bet;
        for (const auto& player : players) {
            if (player.id == current_player) {
                effective_max_bet = player.chip_stack;
                break;
            }
        }
        j["max_bet"] = effective_max_bet;
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
    Deck deck_;

    Player* get_player(const std::string& player_id) {
        for (auto& player : state_.players) {
            if (player.id == player_id) return &player;
        }
        return nullptr;
    }

    // Track how many players have acted in the current betting round.
    // When all active (non-folded, non-all-in) players have acted and bets
    // are equalized, the round advances.
    int players_acted_this_round_ = 0;

    void advance_round() {
        // Reset per-round betting state
        for (auto& p : state_.players) {
            p.current_bet = 0;
            p.last_action.clear();
        }
        state_.current_highest_bet = 0;
        players_acted_this_round_ = 0;

        if (state_.round == "preflop") {
            state_.round = "flop";
            auto dealt = deck_.deal(3);
            state_.community_cards.insert(state_.community_cards.end(), dealt.begin(), dealt.end());
        } else if (state_.round == "flop") {
            state_.round = "turn";
            state_.community_cards.push_back(deck_.deal());
        } else if (state_.round == "turn") {
            state_.round = "river";
            state_.community_cards.push_back(deck_.deal());
        } else if (state_.round == "river") {
            state_.round = "showdown";
            evaluate_and_award();
            return;
        }

        // Set first active player as current for the new round
        for (const auto& p : state_.players) {
            if (!p.is_folded && !p.is_all_in) {
                state_.current_player = p.id;
                return;
            }
        }

        // All players all-in or folded - deal remaining community cards before showdown
        while (state_.community_cards.size() < 5) {
            state_.community_cards.push_back(deck_.deal());
        }
        state_.round = "showdown";
        state_.game_status = "finished";
        evaluate_and_award();
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

            // Only one active player (rest all-in) - deal remaining cards
            advance_round();
            return;
        }

        // Check if all active players have acted and bets are equal
        bool all_bets_equal = true;
        int first_active_bet = -1;
        for (const auto& p : state_.players) {
            if (!p.is_folded && !p.is_all_in) {
                if (first_active_bet < 0) first_active_bet = p.current_bet;
                else if (p.current_bet != first_active_bet) all_bets_equal = false;
            }
        }

        if (all_bets_equal && players_acted_this_round_ >= active_players) {
            advance_round();
            return;
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
        // This shouldn't happen if callers check for single-active-player first,
        // but as a safety net, advance the round
        advance_round();
    }

public:
    PokerGame(SessionManager& sm) : session_manager_(sm) {
        std::lock_guard<std::mutex> lock(mutex_);
        state_.players = { Player{"p1", 1500}, Player{"p2", 1500} };
        state_.players[0].position = "button";
        state_.players[1].position = "big_blind";
        start_new_hand_locked();
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
            players_acted_this_round_++;
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
            players_acted_this_round_++;
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
            players_acted_this_round_++;
            advance_turn();
        } else if (action == "raise") {
            player->last_action = "raise";
            if (amount <= 0) {
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
            // Raise resets the action counter: others must respond
            players_acted_this_round_ = 1;
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

    // Deal 2 hole cards to each player from the deck.
    void deal_hole_cards() {
        for (auto& player : state_.players) {
            player.hole_cards = deck_.deal(2);
        }
    }

    // Evaluate hands at showdown and award the pot to the winner.
    void evaluate_and_award() {
        // Callers set game_status = "finished" before invoking this.
        // Set it here as defense-in-depth.
        state_.game_status = "finished";

        // Only evaluate among non-folded players
        std::vector<Player*> active_players;
        for (auto& p : state_.players) {
            if (!p.is_folded) active_players.push_back(&p);
        }

        if (active_players.size() == 1) {
            active_players[0]->chip_stack += state_.pot;
            state_.last_winner = active_players[0]->id;
            state_.winning_hand = "opponent folded";
        } else if (active_players.size() >= 2) {
            // Evaluate each active player's hand
            std::vector<Player*> winners;
            HandRank bestHand{-1, {}, ""};

            for (auto* p : active_players) {
                HandRank hr = evaluateHand(p->hole_cards, state_.community_cards);
                if (hr.category > bestHand.category ||
                    (hr.category == bestHand.category && hr.kickers > bestHand.kickers)) {
                    bestHand = hr;
                    winners.clear();
                    winners.push_back(p);
                } else if (hr.category == bestHand.category && hr.kickers == bestHand.kickers) {
                    // Tie — split the pot
                    winners.push_back(p);
                }
            }

            if (!winners.empty()) {
                int share = state_.pot / static_cast<int>(winners.size());
                int remainder = state_.pot % static_cast<int>(winners.size());
                for (auto* w : winners) {
                    w->chip_stack += share;
                }
                // Award remainder to first winner (first player in order)
                winners[0]->chip_stack += remainder;
                state_.last_winner = winners[0]->id;
                state_.winning_hand = bestHand.name;
            }
        }

        state_.pot = 0;
        state_.round = "showdown";
    }

    // Initialize a new hand (used by constructor and reset_game).
    // REQUIRES: mutex_ must NOT be held by the caller.
    void start_new_hand() {
        std::lock_guard<std::mutex> lock(mutex_);
        start_new_hand_locked();
    }

private:
    // Internal implementation that assumes mutex_ is already held.
    void start_new_hand_locked() {
        for (auto& player : state_.players) {
            player.current_bet = 0;
            player.is_folded = false;
            player.is_all_in = false;
            player.hole_cards.clear();
            player.last_action.clear();
        }

        // Reset game state
        state_.community_cards.clear();
        state_.last_winner.clear();
        state_.winning_hand.clear();
        state_.round = "preflop";
        state_.game_status = "active";
        state_.pot = 0;
        state_.current_highest_bet = 0;
        players_acted_this_round_ = 0;

        // Shuffle deck and deal hole cards
        deck_.reset();
        deal_hole_cards();

        // Alternate button position each hand for fairness
        bool p1_is_button = (state_.hand_number % 2 == 0);
        state_.players[0].position = p1_is_button ? "button" : "big_blind";
        state_.players[1].position = p1_is_button ? "big_blind" : "button";

        // Post blinds: button is small blind in heads-up
        int sb_idx = p1_is_button ? 0 : 1;
        int bb_idx = p1_is_button ? 1 : 0;

        constexpr int SMALL_BLIND = 25;
        constexpr int BIG_BLIND = 50;

        state_.players[sb_idx].chip_stack -= SMALL_BLIND;
        state_.players[sb_idx].current_bet = SMALL_BLIND;

        state_.players[bb_idx].chip_stack -= BIG_BLIND;
        state_.players[bb_idx].current_bet = BIG_BLIND;

        state_.pot = SMALL_BLIND + BIG_BLIND;
        state_.current_highest_bet = BIG_BLIND;
        state_.min_bet = BIG_BLIND;

        // In heads-up, button/SB acts first preflop
        state_.current_player = state_.players[sb_idx].id;

        // max_bet is the acting player's remaining chip stack
        Player* actor = get_player(state_.current_player);
        state_.max_bet = actor ? actor->chip_stack : std::max(state_.players[0].chip_stack, state_.players[1].chip_stack);

        state_.hand_number++;
    }

    void reset_game() {
        std::lock_guard<std::mutex> lock(mutex_);
        // Full chip reset for a fresh game
        state_.players.clear();
        state_.players = { Player{"p1", 1500}, Player{"p2", 1500} };
        state_.hand_number = 0;
        start_new_hand_locked();
    }
};

std::unique_ptr<SessionManager> session_manager;
std::unique_ptr<PokerGame> poker_game;
std::unique_ptr<RateLimiter> rate_limiter;
std::atomic<bool> server_running(false);

// Global server pointer for signal handler access.
// Signal handlers cannot capture local variables, so we store the server
// instance in a global unique_ptr. The signal handler calls server_ptr->stop()
// to unblock server.run() and trigger graceful shutdown.
std::unique_ptr<WebSocketServer> server_ptr;

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
            std::cerr << "Unknown non-exception error broadcasting to connection" << std::endl;
        }
    }
}

constexpr size_t MAX_MESSAGE_SIZE = 64 * 1024;

void handle_websocket_message(std::shared_ptr<WebSocketChannel> channel, const std::string& msg) {
    std::string client_id = channel_id(channel);

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
            // Handle reconnect_token if provided
            if (message.contains("data") && message["data"].is_object()) {
                auto data = message["data"];
                if (data.contains("reconnect_token") && data["reconnect_token"].is_string()) {
                    std::string reconnect_token = data["reconnect_token"];
                    auto* existing_session = session_manager->get_session(reconnect_token);
                    if (existing_session) {
                        // Reconnect to existing session — update the connection
                        // and send the existing player_id and token back
                        std::string player_id = existing_session->player_id;
                        std::string token = existing_session->token;

                        json response = {
                            {"type", "connection_status"},
                            {"data", {
                                {"status", "connected"},
                                {"player_id", player_id},
                                {"token", token}
                            }}
                        };
                        channel->send(response.dump());

                        json game_response = {
                            {"type", "game_state_update"},
                            {"data", poker_game->get_game_state(player_id)}
                        };
                        channel->send(game_response.dump());
                        return;
                    }
                    // Token not found or expired — fall through to create new session
                }
            }

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

            // Always send the session token so the client can store and use it
            // for authenticating subsequent bet_action messages.
            json response = {
                {"type", "connection_status"},
                {"data", {
                    {"status", "connected"},
                    {"player_id", player_id},
                    {"token", result->token}
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

            // Token is REQUIRED for all bet_action messages — reject if missing or invalid.
            // This prevents unauthenticated message injection.
            if (!message.contains("token") || !message["token"].is_string()) {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "invalid_token"},
                        {"message", "Authentication token required"}
                    }}
                };
                channel->send(error.dump());
                return;
            }

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
            // Validate action is a known value
            if (action != "check" && action != "call" && action != "raise" && action != "fold") {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "invalid_action"},
                        {"message", "Unknown action: " + action}
                    }}
                };
                channel->send(error.dump());
                return;
            }
            int amount = 0;
            if (action == "raise" && (!data.contains("amount") || !data["amount"].is_number_integer())) {
                json error = {
                    {"type", "error"},
                    {"data", {
                        {"code", "invalid_amount"},
                        {"message", "Raise action requires an integer amount"}
                    }}
                };
                channel->send(error.dump());
                return;
            }
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
                // Reject amount for non-raise actions to prevent ambiguity
                if (action != "raise") {
                    json error = {
                        {"type", "error"},
                        {"data", {
                            {"code", "invalid_amount"},
                            {"message", "Amount field is only valid for raise actions"}
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

    HttpService http;
    WebSocketService ws;

    http.document_root = "../client/out";
    http.staticDirs["/"] = "../client/out";

    ws.onopen = [](const WebSocketChannelPtr& channel, const HttpRequestPtr& req) {
        std::cout << "WebSocket connection opened: " << req->path << std::endl;
        // Do not send connection_status here — the client's session_init message
        // triggers a proper connection_status response with player_id and token.
        // Sending a premature status without player_id caused the client to
        // process a redundant message on every connection.
    };

    ws.onmessage = [](const WebSocketChannelPtr& channel, const std::string& msg) {
        handle_websocket_message(channel, msg);
    };

    ws.onclose = [](const WebSocketChannelPtr& channel) {
        std::cout << "WebSocket connection closed: " << channel_id(channel) << std::endl;
        session_manager->remove_session_by_connection(channel_id(channel));
    };

    server_ptr = std::make_unique<WebSocketServer>();
    server_ptr->registerWebSocketService(&ws);
    server_ptr->registerHttpService(&http);
    server_ptr->setPort(8080);
    server_ptr->setThreadNum(4);

    server_running = true;
    std::thread cleanup_thread(cleanup_thread_func);

    // Register signal handlers that stop the hv event loop.
    // server_ptr is a global unique_ptr so it's accessible from the handler.
    std::signal(SIGTERM, [](int) {
        const char msg[] = "Received SIGTERM, shutting down...\n";
        write(STDOUT_FILENO, msg, sizeof(msg) - 1);
        server_running = false;
        if (server_ptr) server_ptr->stop();
    });

    std::signal(SIGINT, [](int) {
        const char msg[] = "Received SIGINT, shutting down...\n";
        write(STDOUT_FILENO, msg, sizeof(msg) - 1);
        server_running = false;
        if (server_ptr) server_ptr->stop();
    });

    std::cout << "Poker server starting on port 8080..." << std::endl;
    std::cout << "HTTP server serving static files from ../client/out" << std::endl;
    std::cout << "WebSocket server ready for connections" << std::endl;

    server_ptr->run();

    server_running = false;
    // Join cleanup thread before resetting globals to prevent use-after-free
    cleanup_thread.join();

    // Graceful shutdown: clean up global state
    server_ptr.reset();
    poker_game.reset();
    session_manager.reset();
    rate_limiter.reset();

    std::cout << "Server shutdown complete." << std::endl;

    return 0;
}
