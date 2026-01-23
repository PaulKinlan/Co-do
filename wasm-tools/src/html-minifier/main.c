/**
 * html-minifier - Minify HTML
 * Usage: html-minifier <html-code>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

void minify_html(const char *html) {
    int in_tag = 0;
    int in_pre = 0;
    int in_script = 0;
    int in_style = 0;
    int prev_space = 0;
    int in_string = 0;
    char string_char = 0;
    int in_comment = 0;

    for (const char *p = html; *p; p++) {
        // HTML comments
        if (!in_string && strncmp(p, "<!--", 4) == 0) {
            in_comment = 1;
            p += 3;
            continue;
        }
        if (in_comment && strncmp(p, "-->", 3) == 0) {
            in_comment = 0;
            p += 2;
            continue;
        }
        if (in_comment) continue;

        // Track special tags
        if (strncasecmp(p, "<pre", 4) == 0 || strncasecmp(p, "<textarea", 9) == 0 ||
            strncasecmp(p, "<code", 5) == 0) {
            in_pre = 1;
        }
        if (strncasecmp(p, "</pre>", 6) == 0 || strncasecmp(p, "</textarea>", 11) == 0 ||
            strncasecmp(p, "</code>", 7) == 0) {
            in_pre = 0;
        }
        if (strncasecmp(p, "<script", 7) == 0) in_script = 1;
        if (strncasecmp(p, "</script>", 9) == 0) in_script = 0;
        if (strncasecmp(p, "<style", 6) == 0) in_style = 1;
        if (strncasecmp(p, "</style>", 8) == 0) in_style = 0;

        // Preserve pre/textarea/code content
        if (in_pre) {
            putchar(*p);
            continue;
        }

        // Handle tags
        if (*p == '<') {
            in_tag = 1;
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
                // Remove optional quotes around simple attribute values
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
    if (argc < 2) {
        fprintf(stderr, "Usage: html-minifier <html-code>\n");
        return 1;
    }

    minify_html(argv[1]);
    printf("\n");

    return 0;
}
