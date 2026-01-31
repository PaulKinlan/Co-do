/**
 * grep - Search for patterns in text (simple substring match)
 * Usage: grep [-i] [-v] [-n] [-c] PATTERN <text>
 * Options: -i (ignore case), -v (invert match), -n (line numbers), -c (count only)
 */

#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>
#include "../stdin_read.h"

// Case-insensitive strstr
char *strcasestr_impl(const char *haystack, const char *needle) {
    if (!*needle) return (char *)haystack;

    for (; *haystack; haystack++) {
        const char *h = haystack;
        const char *n = needle;

        while (*h && *n && (tolower((unsigned char)*h) == tolower((unsigned char)*n))) {
            h++;
            n++;
        }

        if (!*n) return (char *)haystack;
    }
    return NULL;
}

int main(int argc, char **argv) {
    int ignore_case = 0;
    int invert_match = 0;
    int show_line_numbers = 0;
    int count_only = 0;
    const char *pattern = NULL;
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-i") == 0) {
            ignore_case = 1;
        } else if (strcmp(argv[i], "-v") == 0) {
            invert_match = 1;
        } else if (strcmp(argv[i], "-n") == 0) {
            show_line_numbers = 1;
        } else if (strcmp(argv[i], "-c") == 0) {
            count_only = 1;
        } else if (!pattern) {
            pattern = argv[i];
        } else if (!input) {
            input = argv[i];
        }
    }

    char *stdin_buf = NULL;
    if (!pattern) {
        fprintf(stderr, "Usage: grep [-i] [-v] [-n] [-c] PATTERN <text>\nOr pipe text via stdin.\n");
        return 1;
    }
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) { fprintf(stderr, "Usage: grep [-i] [-v] [-n] [-c] PATTERN <text>\nOr pipe text via stdin.\n"); return 1; }
        input = stdin_buf;
    }

    char *input_copy = strdup(input);
    int line_num = 0;
    int match_count = 0;

    char *line = strtok(input_copy, "\n");
    while (line) {
        line_num++;

        // Check for match
        int matched;
        if (ignore_case) {
            matched = strcasestr_impl(line, pattern) != NULL;
        } else {
            matched = strstr(line, pattern) != NULL;
        }

        if (invert_match) matched = !matched;

        if (matched) {
            match_count++;
            if (!count_only) {
                if (show_line_numbers) {
                    printf("%d:", line_num);
                }
                printf("%s\n", line);
            }
        }

        line = strtok(NULL, "\n");
    }

    if (count_only) {
        printf("%d\n", match_count);
    }

    free(input_copy);
    free(stdin_buf);
    return match_count > 0 ? 0 : 1;
}
