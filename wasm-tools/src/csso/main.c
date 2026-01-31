/**
 * csso - CSS optimizer
 * Usage: csso <css-code>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "../stdin_read.h"

void optimize_css(const char *css) {
    int in_comment = 0;
    int in_string = 0;
    char string_char = 0;
    int prev_char = 0;
    int space_needed = 0;
    int in_value = 0;

    for (const char *p = css; *p; p++) {
        // Handle comments
        if (!in_string && *p == '/' && *(p + 1) == '*') {
            in_comment = 1;
            p++;
            continue;
        }
        if (in_comment && *p == '*' && *(p + 1) == '/') {
            in_comment = 0;
            p++;
            continue;
        }
        if (in_comment) continue;

        // Handle strings
        if (!in_string && (*p == '"' || *p == '\'')) {
            in_string = 1;
            string_char = *p;
            putchar(*p);
            prev_char = *p;
            continue;
        }
        if (in_string && *p == string_char && *(p - 1) != '\\') {
            in_string = 0;
            putchar(*p);
            prev_char = *p;
            continue;
        }
        if (in_string) {
            putchar(*p);
            prev_char = *p;
            continue;
        }

        // Track if we're in a value
        if (*p == ':') in_value = 1;
        if (*p == ';' || *p == '{' || *p == '}') in_value = 0;

        // Handle whitespace
        if (isspace((unsigned char)*p)) {
            // Collapse whitespace
            if (prev_char && !strchr("{};:,>+~([", prev_char)) {
                space_needed = 1;
            }
            continue;
        }

        // Optimize: remove leading zeros
        if (*p == '0' && *(p + 1) == '.') {
            p++;  // Skip the zero
            putchar(*p);
            prev_char = *p;
            space_needed = 0;
            continue;
        }

        // Optimize: shorten hex colors
        if (*p == '#' && in_value) {
            putchar(*p);
            prev_char = *p;

            // Check if we can shorten #aabbcc to #abc
            if (isxdigit((unsigned char)*(p + 1)) &&
                isxdigit((unsigned char)*(p + 2)) &&
                isxdigit((unsigned char)*(p + 3)) &&
                isxdigit((unsigned char)*(p + 4)) &&
                isxdigit((unsigned char)*(p + 5)) &&
                isxdigit((unsigned char)*(p + 6))) {

                if (tolower((unsigned char)*(p + 1)) == tolower((unsigned char)*(p + 2)) &&
                    tolower((unsigned char)*(p + 3)) == tolower((unsigned char)*(p + 4)) &&
                    tolower((unsigned char)*(p + 5)) == tolower((unsigned char)*(p + 6))) {
                    // Can shorten
                    putchar(tolower((unsigned char)*(p + 1)));
                    putchar(tolower((unsigned char)*(p + 3)));
                    putchar(tolower((unsigned char)*(p + 5)));
                    p += 6;
                    prev_char = *(p);
                    space_needed = 0;
                    continue;
                }
            }
            continue;
        }

        // Output space if needed (between identifiers)
        if (space_needed && isalnum((unsigned char)*p) && isalnum((unsigned char)prev_char)) {
            putchar(' ');
        }
        space_needed = 0;

        // Optimize: lowercase
        if (isalpha((unsigned char)*p) && !in_value) {
            putchar(tolower((unsigned char)*p));
        } else {
            putchar(*p);
        }
        prev_char = *p;
    }
}

int main(int argc, char **argv) {
    const char *input = (argc >= 2) ? argv[1] : NULL;
    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: csso <css-code>\nOr pipe input via stdin.\n");
            return 1;
        }
        input = stdin_buf;
    }

    optimize_css(input);
    printf("\n");

    free(stdin_buf);
    return 0;
}
