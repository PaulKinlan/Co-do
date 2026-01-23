/**
 * awk - Pattern scanning and processing
 * Usage: awk [-F sep] <program> <text>
 * Supports: {print}, {print $N}, BEGIN, END, /pattern/
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_FIELDS 1024
#define MAX_LINE 65536

static char field_sep[32] = " \t";
static char *fields[MAX_FIELDS];
static int nf = 0;
static int nr = 0;
static char current_line[MAX_LINE];

// Split line into fields
void split_line(char *line) {
    nf = 0;
    char *p = line;

    while (*p && nf < MAX_FIELDS) {
        // Skip separators
        while (*p && strchr(field_sep, *p)) p++;
        if (!*p) break;

        fields[nf++] = p;

        // Find end of field
        while (*p && !strchr(field_sep, *p)) p++;
        if (*p) *p++ = '\0';
    }
}

// Print field or expression
void print_field(const char *expr) {
    if (*expr == '$') {
        int n = atoi(expr + 1);
        if (n == 0) {
            // $0 = whole line
            printf("%s", current_line);
        } else if (n > 0 && n <= nf) {
            printf("%s", fields[n - 1]);
        }
    } else if (strcmp(expr, "NF") == 0) {
        printf("%d", nf);
    } else if (strcmp(expr, "NR") == 0) {
        printf("%d", nr);
    } else {
        // Literal string (strip quotes if present)
        const char *s = expr;
        if (*s == '"') {
            s++;
            while (*s && *s != '"') {
                if (*s == '\\' && *(s+1)) {
                    s++;
                    switch (*s) {
                        case 'n': putchar('\n'); break;
                        case 't': putchar('\t'); break;
                        default: putchar(*s);
                    }
                } else {
                    putchar(*s);
                }
                s++;
            }
        } else {
            printf("%s", expr);
        }
    }
}

// Parse and execute print statement
void exec_print(const char *args) {
    if (!args || !*args) {
        // Print whole line
        printf("%s\n", current_line);
        return;
    }

    char *args_copy = strdup(args);
    char *token = args_copy;
    int first = 1;

    while (*token) {
        // Skip whitespace
        while (*token && isspace((unsigned char)*token)) token++;
        if (!*token) break;

        if (!first) {
            // Default OFS is space
            putchar(' ');
        }
        first = 0;

        // Handle quoted strings
        if (*token == '"') {
            char *end = strchr(token + 1, '"');
            if (end) {
                *end = '\0';
                print_field(token);
                token = end + 1;
            } else {
                print_field(token);
                break;
            }
        } else {
            // Find end of token
            char *end = token;
            while (*end && !isspace((unsigned char)*end) && *end != ',') end++;
            char saved = *end;
            *end = '\0';

            print_field(token);

            if (saved == ',') {
                token = end + 1;
            } else if (saved) {
                token = end + 1;
            } else {
                break;
            }
        }
    }

    putchar('\n');
    free(args_copy);
}

// Simple pattern matching
int match_pattern(const char *line, const char *pattern) {
    return strstr(line, pattern) != NULL;
}

// Parse and execute program
void run_program(const char *program, const char *text) {
    // Very simple parser
    const char *p = program;

    // Check for BEGIN block
    const char *begin_start = strstr(p, "BEGIN");
    const char *end_start = strstr(p, "END");
    const char *main_start = NULL;

    // Find main action block
    const char *brace = strchr(p, '{');
    if (brace) {
        if (begin_start && brace > begin_start && brace < begin_start + 20) {
            // This is BEGIN block, find next
            brace = strchr(brace + 1, '{');
            if (brace) {
                brace = strchr(brace + 1, '{');
            }
        }
        main_start = brace;
    }

    // Execute BEGIN if present
    if (begin_start) {
        const char *b = strchr(begin_start, '{');
        if (b) {
            b++;
            const char *e = strchr(b, '}');
            if (e) {
                char action[1024];
                size_t len = e - b;
                if (len >= sizeof(action)) len = sizeof(action) - 1;
                strncpy(action, b, len);
                action[len] = '\0';

                // Parse action
                if (strstr(action, "print")) {
                    const char *args = strstr(action, "print");
                    args += 5;
                    while (*args && isspace((unsigned char)*args)) args++;
                    exec_print(args);
                }
            }
        }
    }

    // Process lines
    char *text_copy = strdup(text);
    char *line = strtok(text_copy, "\n");

    while (line) {
        nr++;
        strncpy(current_line, line, MAX_LINE - 1);
        current_line[MAX_LINE - 1] = '\0';

        char *line_copy = strdup(line);
        split_line(line_copy);

        // Check pattern if present
        int should_exec = 1;
        const char *pattern_start = strchr(program, '/');
        if (pattern_start && pattern_start < main_start) {
            const char *pattern_end = strchr(pattern_start + 1, '/');
            if (pattern_end) {
                char pattern[256];
                size_t plen = pattern_end - pattern_start - 1;
                if (plen >= sizeof(pattern)) plen = sizeof(pattern) - 1;
                strncpy(pattern, pattern_start + 1, plen);
                pattern[plen] = '\0';

                should_exec = match_pattern(current_line, pattern);
            }
        }

        // Execute main action
        if (should_exec && main_start) {
            const char *action_start = main_start + 1;
            const char *action_end = strchr(action_start, '}');

            if (action_end) {
                char action[1024];
                size_t len = action_end - action_start;
                if (len >= sizeof(action)) len = sizeof(action) - 1;
                strncpy(action, action_start, len);
                action[len] = '\0';

                if (strstr(action, "print")) {
                    const char *args = strstr(action, "print");
                    args += 5;
                    while (*args && isspace((unsigned char)*args)) args++;
                    exec_print(*args ? args : NULL);
                }
            }
        } else if (should_exec && !main_start && !begin_start && !end_start) {
            // Default action: print line
            printf("%s\n", current_line);
        }

        free(line_copy);
        line = strtok(NULL, "\n");
    }

    free(text_copy);

    // Execute END if present
    if (end_start) {
        const char *b = strchr(end_start, '{');
        if (b) {
            b++;
            const char *e = strchr(b, '}');
            if (e) {
                char action[1024];
                size_t len = e - b;
                if (len >= sizeof(action)) len = sizeof(action) - 1;
                strncpy(action, b, len);
                action[len] = '\0';

                if (strstr(action, "print")) {
                    const char *args = strstr(action, "print");
                    args += 5;
                    while (*args && isspace((unsigned char)*args)) args++;
                    exec_print(args);
                }
            }
        }
    }
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: awk [-F sep] <program> <text>\n");
        fprintf(stderr, "Examples:\n");
        fprintf(stderr, "  awk '{print $1}' \"hello world\"\n");
        fprintf(stderr, "  awk -F: '{print $1}' \"user:pass\"\n");
        fprintf(stderr, "  awk '/pattern/{print}' \"text\"\n");
        return 1;
    }

    int arg_idx = 1;

    // Parse options
    while (arg_idx < argc && argv[arg_idx][0] == '-') {
        if (strcmp(argv[arg_idx], "-F") == 0 && arg_idx + 1 < argc) {
            strncpy(field_sep, argv[arg_idx + 1], sizeof(field_sep) - 1);
            arg_idx += 2;
        } else {
            arg_idx++;
        }
    }

    if (argc - arg_idx < 2) {
        fprintf(stderr, "Error: Missing program or text\n");
        return 1;
    }

    const char *program = argv[arg_idx];
    const char *text = argv[arg_idx + 1];

    run_program(program, text);

    return 0;
}
