/**
 * minify - Minify HTML/CSS/JS
 * Usage: minify <type> <code>
 * Types: html, css, js
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// Minify CSS
void minify_css(const char *css) {
    int in_comment = 0;
    int in_string = 0;
    char string_char = 0;
    int prev_char = 0;
    int space_needed = 0;

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
            continue;
        }
        if (in_string && *p == string_char && *(p - 1) != '\\') {
            in_string = 0;
            putchar(*p);
            continue;
        }
        if (in_string) {
            putchar(*p);
            continue;
        }

        // Handle whitespace
        if (isspace((unsigned char)*p)) {
            // Collapse whitespace
            if (prev_char && !strchr("{};:,>+~", prev_char)) {
                space_needed = 1;
            }
            continue;
        }

        // Output space if needed (between identifiers)
        if (space_needed && isalnum((unsigned char)*p) && isalnum((unsigned char)prev_char)) {
            putchar(' ');
        }
        space_needed = 0;

        putchar(*p);
        prev_char = *p;
    }
}

// Minify JavaScript
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
                // May need newline for ASI
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

        // Regex (simplified detection)
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
                // Potential ASI - keep newline
                putchar('\n');
                prev_char = '\n';
            }
            continue;
        }

        // Output space if needed between identifiers
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

// Minify HTML
void minify_html(const char *html) {
    int in_tag = 0;
    int in_pre = 0;
    int in_script = 0;
    int in_style = 0;
    int prev_space = 0;
    int in_string = 0;
    char string_char = 0;

    for (const char *p = html; *p; p++) {
        // Track special tags
        if (strncasecmp(p, "<pre", 4) == 0 || strncasecmp(p, "<textarea", 9) == 0) {
            in_pre = 1;
        }
        if (strncasecmp(p, "</pre>", 6) == 0 || strncasecmp(p, "</textarea>", 11) == 0) {
            in_pre = 0;
        }
        if (strncasecmp(p, "<script", 7) == 0) in_script = 1;
        if (strncasecmp(p, "</script>", 9) == 0) in_script = 0;
        if (strncasecmp(p, "<style", 6) == 0) in_style = 1;
        if (strncasecmp(p, "</style>", 8) == 0) in_style = 0;

        // Preserve pre/textarea content
        if (in_pre) {
            putchar(*p);
            continue;
        }

        // Handle tags
        if (*p == '<') {
            in_tag = 1;
            if (prev_space && !isspace((unsigned char)*(p - 1))) {
                // Keep one space before tag if there was content
            }
            putchar(*p);
            prev_space = 0;
            continue;
        }
        if (*p == '>') {
            in_tag = 0;
            putchar(*p);
            prev_space = 0;
            continue;
        }

        // Inside tags - handle attributes
        if (in_tag) {
            if (*p == '"' || *p == '\'') {
                if (!in_string) {
                    in_string = 1;
                    string_char = *p;
                } else if (*p == string_char) {
                    in_string = 0;
                }
            }

            if (in_string) {
                putchar(*p);
            } else if (isspace((unsigned char)*p)) {
                if (!prev_space) {
                    putchar(' ');
                    prev_space = 1;
                }
            } else {
                putchar(*p);
                prev_space = 0;
            }
            continue;
        }

        // Outside tags - collapse whitespace
        if (isspace((unsigned char)*p)) {
            if (!prev_space) {
                putchar(' ');
                prev_space = 1;
            }
        } else {
            putchar(*p);
            prev_space = 0;
        }
    }
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: minify <type> <code>\n");
        fprintf(stderr, "Types: html, css, js\n");
        return 1;
    }

    const char *type = argv[1];
    const char *code = argv[2];

    if (strcmp(type, "css") == 0) {
        minify_css(code);
    } else if (strcmp(type, "js") == 0) {
        minify_js(code);
    } else if (strcmp(type, "html") == 0) {
        minify_html(code);
    } else {
        fprintf(stderr, "Error: Unknown type '%s'\n", type);
        return 1;
    }

    printf("\n");
    return 0;
}
