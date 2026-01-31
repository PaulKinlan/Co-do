/**
 * tr - Translate or delete characters
 * Usage: tr [-d] SET1 [SET2] <text>
 * Options: -d (delete characters in SET1)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../stdin_read.h"

int main(int argc, char **argv) {
    int delete_mode = 0;
    const char *set1 = NULL;
    const char *set2 = NULL;
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-d") == 0) {
            delete_mode = 1;
        } else if (!set1) {
            set1 = argv[i];
        } else if (!set2 && !delete_mode) {
            set2 = argv[i];
        } else if (!input) {
            input = argv[i];
        }
    }

    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: tr [-d] SET1 [SET2] <text>\n");
            return 1;
        }
        input = stdin_buf;
    }

    if (!set1 || (!delete_mode && !set2)) {
        fprintf(stderr, "Usage: tr [-d] SET1 [SET2] <text>\n");
        free(stdin_buf);
        return 1;
    }

    size_t set1_len = strlen(set1);
    size_t set2_len = set2 ? strlen(set2) : 0;

    for (const char *p = input; *p; p++) {
        // Check if character is in set1
        const char *found = strchr(set1, *p);
        if (found) {
            if (delete_mode) {
                // Skip this character
                continue;
            } else {
                // Translate to corresponding character in set2
                size_t idx = found - set1;
                if (idx < set2_len) {
                    putchar(set2[idx]);
                } else if (set2_len > 0) {
                    // Use last character of set2 if set1 is longer
                    putchar(set2[set2_len - 1]);
                }
            }
        } else {
            putchar(*p);
        }
    }

    free(stdin_buf);
    return 0;
}
