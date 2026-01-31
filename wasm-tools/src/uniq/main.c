/**
 * uniq - Filter adjacent duplicate lines
 * Usage: uniq [-c] [-d] [-u] <text>
 * Options: -c (count), -d (only duplicates), -u (only unique)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../stdin_read.h"

#define MAX_LINE_LEN 4096

int main(int argc, char **argv) {
    int show_count = 0;
    int only_duplicates = 0;
    int only_unique = 0;
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-c") == 0) {
            show_count = 1;
        } else if (strcmp(argv[i], "-d") == 0) {
            only_duplicates = 1;
        } else if (strcmp(argv[i], "-u") == 0) {
            only_unique = 1;
        } else if (argv[i][0] != '-') {
            input = argv[i];
        }
    }

    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: uniq [-c] [-d] [-u] <text>\n");
            return 1;
        }
        input = stdin_buf;
    }

    char *input_copy = strdup(input);
    char prev_line[MAX_LINE_LEN] = "";
    int count = 0;
    int first = 1;

    char *line = strtok(input_copy, "\n");
    while (line) {
        if (first || strcmp(line, prev_line) != 0) {
            // Output previous line if needed
            if (!first) {
                int is_duplicate = count > 1;
                if ((!only_duplicates && !only_unique) ||
                    (only_duplicates && is_duplicate) ||
                    (only_unique && !is_duplicate)) {
                    if (show_count) {
                        printf("%7d %s\n", count, prev_line);
                    } else {
                        printf("%s\n", prev_line);
                    }
                }
            }
            strncpy(prev_line, line, MAX_LINE_LEN - 1);
            prev_line[MAX_LINE_LEN - 1] = '\0';
            count = 1;
            first = 0;
        } else {
            count++;
        }
        line = strtok(NULL, "\n");
    }

    // Output last line
    if (!first) {
        int is_duplicate = count > 1;
        if ((!only_duplicates && !only_unique) ||
            (only_duplicates && is_duplicate) ||
            (only_unique && !is_duplicate)) {
            if (show_count) {
                printf("%7d %s\n", count, prev_line);
            } else {
                printf("%s\n", prev_line);
            }
        }
    }

    free(input_copy);
    free(stdin_buf);
    return 0;
}
