/**
 * wc - Word, line, and character count
 * Usage: wc [options] [text]
 * Options: -l (lines only), -w (words only), -c (chars only)
 */

#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main(int argc, char **argv) {
    int count_lines = 1, count_words = 1, count_chars = 1;
    const char *input = NULL;

    // Parse arguments
    for (int i = 1; i < argc; i++) {
        if (argv[i][0] == '-') {
            // Reset defaults when specific flags given
            if (i == 1 || (argv[i-1][0] == '-')) {
                count_lines = count_words = count_chars = 0;
            }
            for (int j = 1; argv[i][j]; j++) {
                switch (argv[i][j]) {
                    case 'l': count_lines = 1; break;
                    case 'w': count_words = 1; break;
                    case 'c': count_chars = 1; break;
                    default:
                        fprintf(stderr, "Unknown option: -%c\n", argv[i][j]);
                        return 1;
                }
            }
        } else {
            input = argv[i];
        }
    }

    if (!input) {
        fprintf(stderr, "Usage: wc [-lwc] <text>\n");
        return 1;
    }

    int lines = 0, words = 0, chars = 0;
    int in_word = 0;

    for (const char *p = input; *p; p++) {
        chars++;
        if (*p == '\n') lines++;
        if (isspace((unsigned char)*p)) {
            in_word = 0;
        } else if (!in_word) {
            in_word = 1;
            words++;
        }
    }
    // Count final line if no trailing newline
    if (chars > 0 && input[chars-1] != '\n') lines++;

    // Output
    if (count_lines) printf("%d", lines);
    if (count_words) printf("%s%d", count_lines ? " " : "", words);
    if (count_chars) printf("%s%d", (count_lines || count_words) ? " " : "", chars);
    printf("\n");

    return 0;
}
