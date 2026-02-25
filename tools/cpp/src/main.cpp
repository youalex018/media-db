#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <vector>

struct LibraryItem {
    std::string title;
    std::string type;
    std::string status;
    double rating = 0.0;
    std::vector<std::string> genres;
};

class JsonParser {
public:
    explicit JsonParser(const std::string& input) : input_(input), pos_(0) {}

    bool parse_library(std::vector<LibraryItem>& out_items, std::string& error) {
        skip_ws();
        if (!consume('[')) { error = "expected_json_array"; return false; }
        skip_ws();
        if (consume(']')) return true;
        while (true) {
            LibraryItem item;
            if (!parse_object(item, error)) return false;
            out_items.push_back(item);
            skip_ws();
            if (consume(']')) break;
            if (!consume(',')) { error = "expected_array_separator"; return false; }
        }
        skip_ws();
        if (!eof()) { error = "trailing_content"; return false; }
        return true;
    }

private:
    const std::string& input_;
    size_t pos_;

    bool eof() const { return pos_ >= input_.size(); }

    void skip_ws() {
        while (!eof() && std::isspace(static_cast<unsigned char>(input_[pos_])))
            ++pos_;
    }

    bool consume(char expected) {
        if (eof() || input_[pos_] != expected) return false;
        ++pos_;
        return true;
    }

    bool parse_object(LibraryItem& item, std::string& error) {
        skip_ws();
        if (!consume('{')) { error = "expected_object"; return false; }
        skip_ws();
        if (consume('}')) return true;
        while (true) {
            std::string key;
            if (!parse_string(key, error)) return false;
            skip_ws();
            if (!consume(':')) { error = "expected_key_separator"; return false; }
            skip_ws();
            if (key == "title") {
                if (!parse_string(item.title, error)) return false;
            } else if (key == "type") {
                if (!parse_string(item.type, error)) return false;
            } else if (key == "status") {
                if (!parse_string(item.status, error)) return false;
            } else if (key == "rating") {
                if (!parse_number(item.rating, error)) return false;
            } else if (key == "genres") {
                if (!parse_string_array(item.genres, error)) return false;
            } else {
                if (!skip_value(error)) return false;
            }
            skip_ws();
            if (consume('}')) break;
            if (!consume(',')) { error = "expected_object_separator"; return false; }
            skip_ws();
        }
        return true;
    }

    bool parse_string(std::string& out, std::string& error) {
        if (!consume('"')) { error = "expected_string"; return false; }
        std::string result;
        while (!eof()) {
            char c = input_[pos_++];
            if (c == '"') { out = result; return true; }
            if (c == '\\') {
                if (eof()) { error = "unterminated_escape"; return false; }
                char esc = input_[pos_++];
                switch (esc) {
                    case '"': case '\\': case '/': result.push_back(esc); break;
                    case 'b': result.push_back('\b'); break;
                    case 'f': result.push_back('\f'); break;
                    case 'n': result.push_back('\n'); break;
                    case 'r': result.push_back('\r'); break;
                    case 't': result.push_back('\t'); break;
                    case 'u': {
                        if (pos_ + 4 > input_.size()) { error = "unterminated_unicode"; return false; }
                        pos_ += 4;
                        result.push_back('?');
                        break;
                    }
                    default: error = "unsupported_escape"; return false;
                }
            } else {
                result.push_back(c);
            }
        }
        error = "unterminated_string";
        return false;
    }

    bool parse_number(double& out, std::string& error) {
        size_t start = pos_;
        if (!eof() && (input_[pos_] == '-' || input_[pos_] == '+')) ++pos_;
        bool has_digit = false;
        while (!eof() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) { has_digit = true; ++pos_; }
        if (!eof() && input_[pos_] == '.') {
            ++pos_;
            while (!eof() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) { has_digit = true; ++pos_; }
        }
        if (!eof() && (input_[pos_] == 'e' || input_[pos_] == 'E')) {
            ++pos_;
            if (!eof() && (input_[pos_] == '-' || input_[pos_] == '+')) ++pos_;
            while (!eof() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) { has_digit = true; ++pos_; }
        }
        if (!has_digit) { error = "expected_number"; return false; }
        try { out = std::stod(input_.substr(start, pos_ - start)); }
        catch (const std::exception&) { error = "invalid_number"; return false; }
        return true;
    }

    bool parse_string_array(std::vector<std::string>& out, std::string& error) {
        skip_ws();
        if (!consume('[')) { error = "expected_array"; return false; }
        skip_ws();
        if (consume(']')) return true;
        while (true) {
            std::string val;
            if (!parse_string(val, error)) return false;
            out.push_back(val);
            skip_ws();
            if (consume(']')) break;
            if (!consume(',')) { error = "expected_array_separator"; return false; }
            skip_ws();
        }
        return true;
    }

    bool skip_literal(const std::string& literal) {
        if (input_.compare(pos_, literal.size(), literal) != 0) return false;
        pos_ += literal.size();
        return true;
    }

    bool skip_value(std::string& error) {
        skip_ws();
        if (eof()) { error = "unexpected_end"; return false; }
        char c = input_[pos_];
        if (c == '"') { std::string ignored; return parse_string(ignored, error); }
        if (c == '{' || c == '[') {
            char open = c, close = (c == '{') ? '}' : ']';
            int depth = 0;
            do {
                if (input_[pos_] == open) ++depth;
                else if (input_[pos_] == close) --depth;
                ++pos_;
                if (eof() && depth > 0) { error = "unterminated_value"; return false; }
            } while (depth > 0);
            return true;
        }
        if (std::isdigit(static_cast<unsigned char>(c)) || c == '-' || c == '+') {
            double ignored = 0.0; return parse_number(ignored, error);
        }
        if (skip_literal("true") || skip_literal("false") || skip_literal("null")) return true;
        error = "unexpected_value";
        return false;
    }
};

static std::string read_stdin() {
    std::ostringstream buffer;
    buffer << std::cin.rdbuf();
    return buffer.str();
}

static std::string escape_json(const std::string& s) {
    std::string out;
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(c);
        }
    }
    return out;
}

int main() {
    std::string input = read_stdin();
    std::vector<LibraryItem> items;
    std::string error;
    JsonParser parser(input);
    if (!parser.parse_library(items, error)) {
        std::cerr << "error=" << error << "\n";
        return 1;
    }

    struct TypeStats {
        double sum = 0.0;
        int count = 0;
        int rated_count = 0;
        double rated_sum = 0.0;
    };

    std::map<std::string, TypeStats> by_type;
    std::map<std::string, int> by_status;
    std::map<std::string, int> genre_freq;
    TypeStats overall;
    int rated_total = 0;
    double rated_sum = 0.0;
    double highest_rating = 0.0;
    std::string highest_rated_title;

    for (const auto& item : items) {
        by_type[item.type].count += 1;
        by_type[item.type].sum += item.rating;
        overall.count += 1;
        overall.sum += item.rating;

        if (!item.status.empty())
            by_status[item.status] += 1;

        if (item.rating > 0) {
            rated_total += 1;
            rated_sum += item.rating;
            by_type[item.type].rated_count += 1;
            by_type[item.type].rated_sum += item.rating;
            if (item.rating > highest_rating) {
                highest_rating = item.rating;
                highest_rated_title = item.title;
            }
        }

        for (const auto& g : item.genres)
            genre_freq[g] += 1;
    }

    double avg_rated = rated_total > 0 ? (rated_sum / rated_total) : 0.0;

    // Sort genres by frequency descending
    std::vector<std::pair<std::string, int>> sorted_genres(genre_freq.begin(), genre_freq.end());
    std::sort(sorted_genres.begin(), sorted_genres.end(),
        [](const auto& a, const auto& b) { return a.second > b.second; });

    // Output JSON
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "{";

    // types
    std::cout << "\"types\":{";
    bool first = true;
    for (const auto& entry : by_type) {
        if (!first) std::cout << ",";
        first = false;
        double avg = entry.second.rated_count > 0
            ? (entry.second.rated_sum / entry.second.rated_count) : 0.0;
        std::cout << "\"" << entry.first << "\":{"
                  << "\"count\":" << entry.second.count << ","
                  << "\"rated_count\":" << entry.second.rated_count << ","
                  << "\"average_rating\":" << avg << "}";
    }
    std::cout << "},";

    // statuses
    std::cout << "\"statuses\":{";
    first = true;
    for (const auto& entry : by_status) {
        if (!first) std::cout << ",";
        first = false;
        std::cout << "\"" << entry.first << "\":" << entry.second;
    }
    std::cout << "},";

    // top genres (max 10)
    std::cout << "\"top_genres\":[";
    int genre_limit = std::min(static_cast<int>(sorted_genres.size()), 10);
    for (int i = 0; i < genre_limit; ++i) {
        if (i > 0) std::cout << ",";
        std::cout << "{\"name\":\"" << escape_json(sorted_genres[i].first)
                  << "\",\"count\":" << sorted_genres[i].second << "}";
    }
    std::cout << "],";

    // overall
    std::cout << "\"overall\":{"
              << "\"count\":" << overall.count << ","
              << "\"rated_count\":" << rated_total << ","
              << "\"average_rating\":" << avg_rated << ","
              << "\"highest_rating\":" << highest_rating << ","
              << "\"highest_rated\":\"" << escape_json(highest_rated_title) << "\""
              << "}}";

    return 0;
}
