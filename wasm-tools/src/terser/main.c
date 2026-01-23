/**
 * terser - JavaScript minifier/compressor
 * Usage: terser <javascript-code>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// Forward reference to minify_js from minify tool
void minify_js(const char *js) {
    int in_single_comment = 0;
    int in_multi_comment = 0;
    int in_string = 0;
    int in_regex = 0;
    char string_char = 0;
    char prev_char = 0;
    char prev_non_space = 0;
    int space_needed = 0;

    for (const char *p = js; *p; p++) {
        // Single-line comment
        if (!in_string && !in_multi_comment && !in_regex &&
            *p == '/' && *(p + 1) == '/') {
            in_single_comment = 1;
            p++;
            continue;
        }
        if (in_single_comment) {
            if (*p == '\n') {
                in_single_comment = 0;
                if (prev_non_space && !strchr("{};,([", prev_non_space)) {
                    putchar('\n');
                }
            }
            continue;
        }

        // Multi-line comment
        if (!in_string && !in_regex && *p == '/' && *(p + 1) == '*') {
            in_multi_comment = 1;
            p++;
            continue;
        }
        if (in_multi_comment && *p == '*' && *(p + 1) == '/') {
            in_multi_comment = 0;
            p++;
            continue;
        }
        if (in_multi_comment) continue;

        // Strings
        if (!in_string && !in_regex && (*p == '"' || *p == '\'' || *p == '`')) {
            in_string = 1;
            string_char = *p;
            putchar(*p);
            prev_char = *p;
            prev_non_space = *p;
            continue;
        }
        if (in_string && *p == string_char && *(p - 1) != '\\') {
            in_string = 0;
            putchar(*p);
            prev_char = *p;
            prev_non_space = *p;
            continue;
        }
        if (in_string) {
            putchar(*p);
            prev_char = *p;
            continue;
        }

        // Regex
        if (!in_regex && *p == '/' &&
            (prev_non_space == '=' || prev_non_space == '(' ||
             prev_non_space == ',' || prev_non_space == ':' ||
             prev_non_space == '[' || prev_non_space == '!' ||
             prev_non_space == '&' || prev_non_space == '|' ||
             prev_non_space == '?' || prev_non_space == '{' ||
             prev_non_space == ';' || prev_char == '\n')) {
            in_regex = 1;
            putchar(*p);
            prev_char = *p;
            prev_non_space = *p;
            continue;
        }
        if (in_regex && *p == '/' && *(p - 1) != '\\') {
            in_regex = 0;
            putchar(*p);
            prev_char = *p;
            prev_non_space = *p;
            continue;
        }
        if (in_regex) {
            putchar(*p);
            prev_char = *p;
            continue;
        }

        // Whitespace
        if (isspace((unsigned char)*p)) {
            if (prev_char && isalnum((unsigned char)prev_char)) {
                space_needed = 1;
            }
            if (*p == '\n' && prev_non_space &&
                !strchr("{};,([+\\-*/%=<>!&|?:", prev_non_space)) {
                putchar('\n');
                prev_char = '\n';
            }
            continue;
        }

        // Output space if needed
        if (space_needed &&
            (isalnum((unsigned char)*p) || *p == '_' || *p == '$') &&
            (isalnum((unsigned char)prev_char) || prev_char == '_' || prev_char == '$')) {
            putchar(' ');
        }
        space_needed = 0;

        putchar(*p);
        prev_char = *p;
        if (!isspace((unsigned char)*p)) {
            prev_non_space = *p;
        }
    }
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: terser <javascript-code>\n");
        return 1;
    }

    minify_js(argv[1]);
    printf("\n");

    return 0;
}
