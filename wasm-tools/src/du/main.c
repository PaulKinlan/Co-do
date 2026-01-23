/**
 * du - Estimate file space usage
 * Usage: du [-h] [-s] <sizes>
 * Input: Newline-separated "size path" pairs
 * Options: -h (human readable), -s (summary only)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void format_size(long long size, char *buf, size_t buf_len, int human_readable) {
    if (!human_readable) {
        snprintf(buf, buf_len, "%lld", (size + 1023) / 1024);  // Convert to KB blocks
        return;
    }

    const char *units[] = {"B", "K", "M", "G", "T"};
    int unit_idx = 0;
    double display_size = (double)size;

    while (display_size >= 1024 && unit_idx < 4) {
        display_size /= 1024;
        unit_idx++;
    }

    if (unit_idx == 0) {
        snprintf(buf, buf_len, "%.0f%s", display_size, units[unit_idx]);
    } else if (display_size < 10) {
        snprintf(buf, buf_len, "%.1f%s", display_size, units[unit_idx]);
    } else {
        snprintf(buf, buf_len, "%.0f%s", display_size, units[unit_idx]);
    }
}

int main(int argc, char **argv) {
    int human_readable = 0;
    int summary_only = 0;
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-h") == 0) {
            human_readable = 1;
        } else if (strcmp(argv[i], "-s") == 0) {
            summary_only = 1;
        } else if (argv[i][0] != '-') {
            input = argv[i];
        }
    }

    if (!input) {
        fprintf(stderr, "Usage: du [-h] [-s] <sizes>\n");
        fprintf(stderr, "Input: Newline-separated \"size path\" pairs\n");
        fprintf(stderr, "Options:\n");
        fprintf(stderr, "  -h  Human-readable sizes\n");
        fprintf(stderr, "  -s  Summary only (total)\n");
        return 1;
    }

    char *input_copy = strdup(input);
    char *line = strtok(input_copy, "\n");
    long long total = 0;
    char size_str[32];

    while (line) {
        // Skip whitespace
        while (*line == ' ' || *line == '\t') line++;

        if (*line) {
            // Parse "size path" format
            long long size = 0;
            char path[1024] = "";

            if (sscanf(line, "%lld %1023[^\n]", &size, path) >= 1) {
                total += size;

                if (!summary_only) {
                    format_size(size, size_str, sizeof(size_str), human_readable);
                    printf("%s\t%s\n", size_str, path[0] ? path : ".");
                }
            }
        }

        line = strtok(NULL, "\n");
    }

    // Print total
    format_size(total, size_str, sizeof(size_str), human_readable);
    if (summary_only) {
        printf("%s\ttotal\n", size_str);
    } else {
        printf("%s\ttotal\n", size_str);
    }

    free(input_copy);
    return 0;
}
