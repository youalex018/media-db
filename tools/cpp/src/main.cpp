#include <cctype>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

struct RatingItem {
    std::string type;
    double rating = 0.0;
};

class JsonParser {
public:
    explicit JsonParser(const std::string& input) : input_(input), pos_(0) {}

    bool parse_ratings(std::vector<RatingItem>& out_items, std::string& error) {
        skip_ws();
        if (!consume('[')) {
            error = "expected_json_array";
            return false;
        }
        skip_ws();
        if (consume(']')) {
            return true;
        }
        while (true) {
            RatingItem item;
            if (!parse_object(item, error)) {
                return false;
            }
            out_items.push_back(item);
            skip_ws();
            if (consume(']')) {
                break;
            }
            if (!consume(',')) {
                error = "expected_array_separator";
                return false;
            }
        }
        skip_ws();
        if (!eof()) {
            error = "trailing_content";
            return false;
        }
        return true;
    }

private:
    const std::string& input_;
    size_t pos_;

    bool eof() const { return pos_ >= input_.size(); }

    void skip_ws() {
        while (!eof() && std::isspace(static_cast<unsigned char>(input_[pos_]))) {
            ++pos_;
        }
    }

    bool consume(char expected) {
        if (eof() || input_[pos_] != expected) {
            return false;
        }
        ++pos_;
        return true;
    }

    bool parse_object(RatingItem& item, std::string& error) {
        skip_ws();
        if (!consume('{')) {
            error = "expected_object";
            return false;
        }
        bool has_type = false;
        bool has_rating = false;
        skip_ws();
        if (consume('}')) {
            error = "empty_object";
            return false;
        }
        while (true) {
            std::string key;
            if (!parse_string(key, error)) {
                return false;
            }
            skip_ws();
            if (!consume(':')) {
                error = "expected_key_separator";
                return false;
            }
            skip_ws();
            if (key == "type") {
                std::string value;
                if (!parse_string(value, error)) {
                    return false;
                }
                item.type = value;
                has_type = true;
            } else if (key == "rating") {
                double value = 0.0;
                if (!parse_number(value, error)) {
                    return false;
                }
                item.rating = value;
                has_rating = true;
            } else {
                if (!skip_value(error)) {
                    return false;
                }
            }
            skip_ws();
            if (consume('}')) {
                break;
            }
            if (!consume(',')) {
                error = "expected_object_separator";
                return false;
            }
            skip_ws();
        }
        if (!has_type || !has_rating) {
            error = "missing_required_fields";
            return false;
        }
        return true;
    }

    bool parse_string(std::string& out, std::string& error) {
        if (!consume('"')) {
            error = "expected_string";
            return false;
        }
        std::string result;
        while (!eof()) {
            char c = input_[pos_++];
            if (c == '"') {
                out = result;
                return true;
            }
            if (c == '\\') {
                if (eof()) {
                    error = "unterminated_escape";
                    return false;
                }
                char esc = input_[pos_++];
                switch (esc) {
                    case '"':
                    case '\\':
                    case '/':
                        result.push_back(esc);
                        break;
                    case 'b':
                        result.push_back('\b');
                        break;
                    case 'f':
                        result.push_back('\f');
                        break;
                    case 'n':
                        result.push_back('\n');
                        break;
                    case 'r':
                        result.push_back('\r');
                        break;
                    case 't':
                        result.push_back('\t');
                        break;
                    default:
                        error = "unsupported_escape";
                        return false;
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
        if (!eof() && (input_[pos_] == '-' || input_[pos_] == '+')) {
            ++pos_;
        }
        bool has_digit = false;
        while (!eof() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) {
            has_digit = true;
            ++pos_;
        }
        if (!eof() && input_[pos_] == '.') {
            ++pos_;
            while (!eof() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) {
                has_digit = true;
                ++pos_;
            }
        }
        if (!eof() && (input_[pos_] == 'e' || input_[pos_] == 'E')) {
            ++pos_;
            if (!eof() && (input_[pos_] == '-' || input_[pos_] == '+')) {
                ++pos_;
            }
            while (!eof() && std::isdigit(static_cast<unsigned char>(input_[pos_]))) {
                has_digit = true;
                ++pos_;
            }
        }
        if (!has_digit) {
            error = "expected_number";
            return false;
        }
        try {
            out = std::stod(input_.substr(start, pos_ - start));
        } catch (const std::exception&) {
            error = "invalid_number";
            return false;
        }
        return true;
    }

    bool skip_literal(const std::string& literal) {
        if (input_.compare(pos_, literal.size(), literal) != 0) {
            return false;
        }
        pos_ += literal.size();
        return true;
    }

    bool skip_value(std::string& error) {
        skip_ws();
        if (eof()) {
            error = "unexpected_end";
            return false;
        }
        char c = input_[pos_];
        if (c == '"') {
            std::string ignored;
            return parse_string(ignored, error);
        }
        if (c == '{') {
            int depth = 0;
            do {
                if (input_[pos_] == '{') {
                    ++depth;
                } else if (input_[pos_] == '}') {
                    --depth;
                }
                ++pos_;
                if (eof()) {
                    error = "unterminated_object";
                    return false;
                }
            } while (depth > 0);
            return true;
        }
        if (c == '[') {
            int depth = 0;
            do {
                if (input_[pos_] == '[') {
                    ++depth;
                } else if (input_[pos_] == ']') {
                    --depth;
                }
                ++pos_;
                if (eof()) {
                    error = "unterminated_array";
                    return false;
                }
            } while (depth > 0);
            return true;
        }
        if (std::isdigit(static_cast<unsigned char>(c)) || c == '-' || c == '+') {
            double ignored = 0.0;
            return parse_number(ignored, error);
        }
        if (skip_literal("true") || skip_literal("false") || skip_literal("null")) {
            return true;
        }
        error = "unexpected_value";
        return false;
    }
};

static std::string read_stdin() {
    std::ostringstream buffer;
    buffer << std::cin.rdbuf();
    return buffer.str();
}

int main() {
    std::string input = read_stdin();
    std::vector<RatingItem> items;
    std::string error;
    JsonParser parser(input);
    if (!parser.parse_ratings(items, error)) {
        std::cerr << "error=" << error << "\n";
        return 1;
    }

    struct Stats {
        double sum = 0.0;
        int count = 0;
    };

    std::map<std::string, Stats> stats_by_type;
    Stats overall;

    for (const auto& item : items) {
        stats_by_type[item.type].sum += item.rating;
        stats_by_type[item.type].count += 1;
        overall.sum += item.rating;
        overall.count += 1;
    }

    std::cout << "{";
    std::cout << "\"types\":{";
    bool first = true;
    for (const auto& entry : stats_by_type) {
        if (!first) {
            std::cout << ",";
        }
        first = false;
        const auto& key = entry.first;
        const auto& stat = entry.second;
        double avg = stat.count > 0 ? (stat.sum / stat.count) : 0.0;
        std::cout << "\"" << key << "\":{";
        std::cout << "\"average_rating\":" << std::fixed << std::setprecision(2) << avg << ",";
        std::cout << "\"count\":" << stat.count << "}";
    }
    std::cout << "},";
    double overall_avg = overall.count > 0 ? (overall.sum / overall.count) : 0.0;
    std::cout << "\"overall\":{";
    std::cout << "\"average_rating\":" << std::fixed << std::setprecision(2) << overall_avg << ",";
    std::cout << "\"count\":" << overall.count << "}";
    std::cout << "}";

    return 0;
}
