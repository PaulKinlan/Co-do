/**
 * fzf - Fuzzy finder (simplified)
 * Usage: fzf <query> <items>
 * Items: newline-separated list
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_ITEMS 10000

typedef struct {
    char *text;
    int score;
} ScoredItem;

// Calculate fuzzy match score
// Higher score = better match
int fuzzy_score(const char *text, const char *query) {
    if (!query || !*query) return 100;  // Empty query matches everything

    const char *t = text;
    const char *q = query;
    int score = 0;
    int consecutive = 0;
    int prev_matched = 0;
    int query_len = strlen(query);
    int text_len = strlen(text);

    // Must match all query characters
    while (*q) {
        char qc = tolower((unsigned char)*q);
        int found = 0;

        while (*t) {
            char tc = tolower((unsigned char)*t);
            t++;

            if (tc == qc) {
                found = 1;

                // Bonus for consecutive matches
                if (prev_matched) {
                    consecutive++;
                    score += 10 + consecutive * 5;
                } else {
                    consecutive = 0;
                    score += 10;
                }

                // Bonus for match at start
                if (t - text == 1) {
                    score += 20;
                }

                // Bonus for match after separator
                if (t > text + 1) {
                    char prev = *(t - 2);
                    if (prev == '/' || prev == '\\' || prev == '_' || prev == '-' ||
                        prev == '.' || prev == ' ') {
                        score += 15;
                    }
                    // Bonus for CamelCase
                    if (isupper((unsigned char)*(t - 1)) && islower((unsigned char)prev)) {
                        score += 15;
                    }
                }

                prev_matched = 1;
                break;
            }

            prev_matched = 0;
        }

        if (!found) return -1;  // Query char not found
        q++;
    }

    // Penalty for longer strings (prefer shorter matches)
    score -= (text_len - query_len) / 2;

    return score;
}

// Compare function for sorting
int compare_items(const void *a, const void *b) {
    const ScoredItem *ia = (const ScoredItem *)a;
    const ScoredItem *ib = (const ScoredItem *)b;
    return ib->score - ia->score;  // Descending
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: fzf <query> <items>\n");
        fprintf(stderr, "Items: newline-separated list\n");
        return 1;
    }

    const char *query = argv[1];
    const char *input = argv[2];

    // Parse items
    char *input_copy = strdup(input);
    ScoredItem items[MAX_ITEMS];
    int item_count = 0;

    char *line = strtok(input_copy, "\n");
    while (line && item_count < MAX_ITEMS) {
        // Skip empty lines
        while (*line && isspace((unsigned char)*line)) line++;
        if (*line) {
            int score = fuzzy_score(line, query);
            if (score >= 0) {
                items[item_count].text = line;
                items[item_count].score = score;
                item_count++;
            }
        }
        line = strtok(NULL, "\n");
    }

    // Sort by score
    qsort(items, item_count, sizeof(ScoredItem), compare_items);

    // Output top matches (max 20)
    int max_output = item_count < 20 ? item_count : 20;
    for (int i = 0; i < max_output; i++) {
        printf("%s\n", items[i].text);
    }

    if (item_count > 20) {
        printf("... and %d more matches\n", item_count - 20);
    }

    free(input_copy);
    return item_count > 0 ? 0 : 1;
}
