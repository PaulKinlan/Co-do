/**
 * shfmt - Format shell scripts (simplified)
 * Usage: shfmt <shell-script>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_LINE 4096

void format_shell(const char *script) {
    char *script_copy = strdup(script);
    int indent_level = 0;
    int in_string = 0;
    char string_char = 0;
    int line_start = 1;
    int continued_line = 0;

    for (char *p = script_copy; *p; p++) {
        // Track strings
        if (!in_string && (*p == '"' || *p == '\'')) {
            in_string = 1;
            string_char = *p;
        } else if (in_string && *p == string_char && *(p - 1) != '\\') {
            in_string = 0;
        }

        // Line continuation
        if (*p == '\\' && *(p + 1) == '\n') {
            putchar(*p++);
            putchar(*p);
            continued_line = 1;
            line_start = 1;
            continue;
        }

        // Handle newlines
        if (*p == '\n') {
            putchar(*p);
            line_start = 1;

            // Adjust indent for next line
            if (!continued_line && !in_string) {
                // Look back for keywords
                char *line_end = p;
                char *line_start_p = p - 1;
                while (line_start_p > script_copy && *(line_start_p - 1) != '\n') {
                    line_start_p--;
                }

                // Skip leading whitespace
                while (line_start_p < line_end && isspace((unsigned char)*line_start_p)) {
                    line_start_p++;
                }

                // Check for indent-increasing keywords
                if (strncmp(line_start_p, "if ", 3) == 0 ||
                    strncmp(line_start_p, "then", 4) == 0 ||
                    strncmp(line_start_p, "else", 4) == 0 ||
                    strncmp(line_start_p, "elif ", 5) == 0 ||
                    strncmp(line_start_p, "for ", 4) == 0 ||
                    strncmp(line_start_p, "while ", 6) == 0 ||
                    strncmp(line_start_p, "until ", 6) == 0 ||
                    strncmp(line_start_p, "case ", 5) == 0 ||
                    strncmp(line_start_p, "do", 2) == 0 ||
                    (strchr(line_start_p, '{') && !in_string)) {
                    // Don't double-indent if the line itself is then/do/else
                    if (!(strncmp(line_start_p, "then", 4) == 0 ||
                          strncmp(line_start_p, "do", 2) == 0 ||
                          strncmp(line_start_p, "else", 4) == 0)) {
                        // Check for single-line if/for
                        if (!strstr(line_start_p, "; then") && !strstr(line_start_p, "; do")) {
                            // Multi-line, will indent after then/do
                        }
                    }
                }
            }
            continued_line = 0;
            continue;
        }

        // Output indentation at line start
        if (line_start && !in_string) {
            // Skip leading whitespace in input
            while (isspace((unsigned char)*p) && *p != '\n') p++;
            if (*p == '\n') {
                putchar('\n');
                continue;
            }

            // Decrease indent before closing keywords
            if (strncmp(p, "fi", 2) == 0 ||
                strncmp(p, "done", 4) == 0 ||
                strncmp(p, "esac", 4) == 0 ||
                strncmp(p, "}", 1) == 0) {
                if (indent_level > 0) indent_level--;
            }
            if (strncmp(p, "else", 4) == 0 ||
                strncmp(p, "elif", 4) == 0) {
                if (indent_level > 0) indent_level--;
            }

            // Output indent
            for (int i = 0; i < indent_level; i++) {
                putchar('\t');
            }
            line_start = 0;

            // Increase indent after certain keywords
            if (strncmp(p, "then", 4) == 0 ||
                strncmp(p, "else", 4) == 0 ||
                strncmp(p, "elif", 4) == 0 ||
                strncmp(p, "do", 2) == 0 ||
                strncmp(p, "{", 1) == 0) {
                indent_level++;
            }
        }

        putchar(*p);
    }

    free(script_copy);
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: shfmt <shell-script>\n");
        return 1;
    }

    format_shell(argv[1]);

    return 0;
}
