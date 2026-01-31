/**
 * toml2json - Convert TOML to JSON
 * Usage: toml2json <toml-data>
 * Note: Simplified TOML parser supporting basic key-value pairs and sections
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "../stdin_read.h"

#define MAX_SECTIONS 100
#define MAX_KEYS 1000
#define MAX_LINE 4096

typedef struct {
    char section[256];
    char key[256];
    char value[4096];
    int value_type;  // 0=string, 1=number, 2=bool, 3=array
} TOMLEntry;

static TOMLEntry entries[MAX_KEYS];
static int entry_count = 0;
static char current_section[256] = "";

// Trim whitespace
char* trim(char *str) {
    while (isspace((unsigned char)*str)) str++;
    if (*str == 0) return str;

    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;
    *(end + 1) = '\0';

    return str;
}

// Escape string for JSON
void print_json_string(const char *str) {
    putchar('"');
    for (const char *p = str; *p; p++) {
        switch (*p) {
            case '"': printf("\\\""); break;
            case '\\': printf("\\\\"); break;
            case '\n': printf("\\n"); break;
            case '\r': printf("\\r"); break;
            case '\t': printf("\\t"); break;
            default:
                if ((unsigned char)*p < 32) {
                    printf("\\u%04x", (unsigned char)*p);
                } else {
                    putchar(*p);
                }
        }
    }
    putchar('"');
}

// Parse TOML value
int parse_value(const char *value, char *out, int *type) {
    const char *v = trim((char*)value);

    // Boolean
    if (strcmp(v, "true") == 0 || strcmp(v, "false") == 0) {
        strcpy(out, v);
        *type = 2;
        return 1;
    }

    // Number (int or float)
    if ((*v == '-' || *v == '+' || isdigit((unsigned char)*v))) {
        int is_number = 1;
        int has_dot = 0;
        const char *p = v;
        if (*p == '-' || *p == '+') p++;

        while (*p) {
            if (*p == '.') {
                if (has_dot) { is_number = 0; break; }
                has_dot = 1;
            } else if (*p == 'e' || *p == 'E') {
                p++;
                if (*p == '+' || *p == '-') p++;
                continue;
            } else if (!isdigit((unsigned char)*p) && *p != '_') {
                is_number = 0;
                break;
            }
            p++;
        }

        if (is_number) {
            // Remove underscores
            char *o = out;
            for (const char *i = v; *i; i++) {
                if (*i != '_') *o++ = *i;
            }
            *o = '\0';
            *type = 1;
            return 1;
        }
    }

    // Array
    if (*v == '[') {
        strcpy(out, v);
        *type = 3;
        return 1;
    }

    // String (quoted or bare)
    if (*v == '"' || *v == '\'') {
        char quote = *v;
        v++;
        char *o = out;
        while (*v && *v != quote) {
            if (*v == '\\' && *(v+1)) {
                v++;
                switch (*v) {
                    case 'n': *o++ = '\n'; break;
                    case 'r': *o++ = '\r'; break;
                    case 't': *o++ = '\t'; break;
                    case '\\': *o++ = '\\'; break;
                    case '"': *o++ = '"'; break;
                    case '\'': *o++ = '\''; break;
                    default: *o++ = *v;
                }
            } else {
                *o++ = *v;
            }
            v++;
        }
        *o = '\0';
        *type = 0;
        return 1;
    }

    // Bare string (unquoted)
    strcpy(out, v);
    *type = 0;
    return 1;
}

// Parse a TOML line
void parse_line(char *line) {
    char *l = trim(line);

    // Skip empty lines and comments
    if (*l == '\0' || *l == '#') return;

    // Section header
    if (*l == '[') {
        char *end = strchr(l, ']');
        if (end) {
            *end = '\0';
            strncpy(current_section, l + 1, sizeof(current_section) - 1);
            current_section[sizeof(current_section) - 1] = '\0';
        }
        return;
    }

    // Key-value pair
    char *eq = strchr(l, '=');
    if (eq && entry_count < MAX_KEYS) {
        *eq = '\0';
        char *key = trim(l);
        char *value = trim(eq + 1);

        strncpy(entries[entry_count].section, current_section, 255);
        strncpy(entries[entry_count].key, key, 255);
        parse_value(value, entries[entry_count].value, &entries[entry_count].value_type);
        entry_count++;
    }
}

// Print JSON output
void print_json(void) {
    printf("{\n");

    // Group by section
    char sections[MAX_SECTIONS][256];
    int section_count = 0;

    // Collect unique sections
    for (int i = 0; i < entry_count; i++) {
        int found = 0;
        for (int j = 0; j < section_count; j++) {
            if (strcmp(sections[j], entries[i].section) == 0) {
                found = 1;
                break;
            }
        }
        if (!found && section_count < MAX_SECTIONS) {
            strcpy(sections[section_count++], entries[i].section);
        }
    }

    int first_section = 1;
    for (int s = 0; s < section_count; s++) {
        if (!first_section) printf(",\n");
        first_section = 0;

        if (sections[s][0]) {
            // Named section
            printf("  ");
            print_json_string(sections[s]);
            printf(": {\n");

            int first_key = 1;
            for (int i = 0; i < entry_count; i++) {
                if (strcmp(entries[i].section, sections[s]) == 0) {
                    if (!first_key) printf(",\n");
                    first_key = 0;

                    printf("    ");
                    print_json_string(entries[i].key);
                    printf(": ");

                    switch (entries[i].value_type) {
                        case 0: print_json_string(entries[i].value); break;
                        case 1:
                        case 2:
                        case 3: printf("%s", entries[i].value); break;
                    }
                }
            }

            printf("\n  }");
        } else {
            // Root level keys
            int first_key = 1;
            for (int i = 0; i < entry_count; i++) {
                if (entries[i].section[0] == '\0') {
                    if (!first_key) printf(",\n");
                    first_key = 0;

                    printf("  ");
                    print_json_string(entries[i].key);
                    printf(": ");

                    switch (entries[i].value_type) {
                        case 0: print_json_string(entries[i].value); break;
                        case 1:
                        case 2:
                        case 3: printf("%s", entries[i].value); break;
                    }
                }
            }
        }
    }

    printf("\n}\n");
}

int main(int argc, char **argv) {
    const char *input = (argc >= 2) ? argv[1] : NULL;
    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: toml2json <toml-data>\nOr pipe input via stdin.\n");
            return 1;
        }
        input = stdin_buf;
    }

    char *data = strdup(input);
    char *line = strtok(data, "\n");

    while (line) {
        parse_line(line);
        line = strtok(NULL, "\n");
    }

    free(data);
    print_json();

    free(stdin_buf);
    return 0;
}
