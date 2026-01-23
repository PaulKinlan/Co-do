/**
 * sed - Stream editor for text transformation
 * Usage: sed <expression> <text>
 * Supports: s/pattern/replacement/[g]
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_LINE 65536

// Simple pattern matching (not full regex)
// Supports: . (any char), * (zero or more), ^ (start), $ (end)
int match_pattern(const char *text, const char *pattern, int *match_start, int *match_end) {
    const char *t = text;
    const char *p = pattern;
    int start = 0;

    // Handle ^ anchor
    if (*p == '^') {
        p++;
        start = 0;
    }

    const char *text_start = t;

    while (*t) {
        const char *tt = t;
        const char *pp = p;
        int matched = 1;

        while (*pp && *pp != '$') {
            if (*(pp + 1) == '*') {
                // Zero or more of previous char
                char match_char = *pp;
                pp += 2;

                while (*tt && (match_char == '.' || *tt == match_char)) {
                    tt++;
                }
            } else if (*pp == '.') {
                // Match any character
                if (*tt) {
                    tt++;
                    pp++;
                } else {
                    matched = 0;
                    break;
                }
            } else if (*pp == *tt) {
                tt++;
                pp++;
            } else {
                matched = 0;
                break;
            }
        }

        // Handle $ anchor
        if (*pp == '$' && *tt != '\0' && *tt != '\n') {
            matched = 0;
        }

        if (matched) {
            *match_start = t - text_start;
            *match_end = tt - text_start;
            return 1;
        }

        // If pattern started with ^, only try at start
        if (*pattern == '^') break;

        t++;
    }

    return 0;
}

// Substitute command
void cmd_substitute(const char *text, const char *pattern, const char *replacement, int global) {
    char result[MAX_LINE];
    const char *src = text;
    char *dst = result;
    int replaced = 0;

    while (*src) {
        int match_start, match_end;

        if ((!replaced || global) && match_pattern(src, pattern, &match_start, &match_end)) {
            // Copy text before match
            for (int i = 0; i < match_start; i++) {
                *dst++ = src[i];
            }

            // Copy replacement
            for (const char *r = replacement; *r; r++) {
                *dst++ = *r;
            }

            src += match_end;
            replaced = 1;
        } else {
            *dst++ = *src++;
        }
    }

    *dst = '\0';
    printf("%s", result);
}

// Parse s/pattern/replacement/flags
int parse_substitute(const char *expr, char *pattern, char *replacement, int *global) {
    if (*expr != 's') return 0;

    char delim = expr[1];
    if (!delim) return 0;

    const char *p = expr + 2;
    char *out = pattern;

    // Extract pattern
    while (*p && *p != delim) {
        if (*p == '\\' && *(p+1)) {
            p++;
        }
        *out++ = *p++;
    }
    *out = '\0';

    if (*p != delim) return 0;
    p++;

    // Extract replacement
    out = replacement;
    while (*p && *p != delim) {
        if (*p == '\\' && *(p+1)) {
            p++;
        }
        *out++ = *p++;
    }
    *out = '\0';

    // Check flags
    *global = 0;
    if (*p == delim) {
        p++;
        while (*p) {
            if (*p == 'g') *global = 1;
            p++;
        }
    }

    return 1;
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: sed <expression> <text>\n");
        fprintf(stderr, "Expressions:\n");
        fprintf(stderr, "  s/pattern/replacement/[g]  Substitute\n");
        return 1;
    }

    const char *expr = argv[1];
    const char *text = argv[2];

    char pattern[1024];
    char replacement[1024];
    int global;

    if (parse_substitute(expr, pattern, replacement, &global)) {
        char *text_copy = strdup(text);
        char *line = strtok(text_copy, "\n");

        while (line) {
            cmd_substitute(line, pattern, replacement, global);
            putchar('\n');
            line = strtok(NULL, "\n");
        }

        free(text_copy);
    } else {
        fprintf(stderr, "Error: Unsupported expression\n");
        return 1;
    }

    return 0;
}
