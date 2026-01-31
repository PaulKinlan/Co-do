/**
 * yq - YAML query and transform
 * Usage: yq <filter> <yaml>
 * Supports basic YAML and jq-like filters
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "../stdin_read.h"

#define MAX_DEPTH 100
#define MAX_LINE 4096

typedef enum {
    YAML_NULL,
    YAML_BOOL,
    YAML_NUMBER,
    YAML_STRING,
    YAML_ARRAY,
    YAML_OBJECT
} YamlType;

typedef struct YamlValue {
    YamlType type;
    char *key;
    union {
        int bool_val;
        double num_val;
        char *str_val;
        struct {
            struct YamlValue **items;
            int count;
        } array;
        struct {
            struct YamlValue **items;
            int count;
        } object;
    } data;
} YamlValue;

void free_yaml(YamlValue *v);

YamlValue* create_value(YamlType type) {
    YamlValue *v = (YamlValue *)calloc(1, sizeof(YamlValue));
    v->type = type;
    return v;
}

// Get indentation level
int get_indent(const char *line) {
    int indent = 0;
    while (*line == ' ') {
        indent++;
        line++;
    }
    return indent;
}

// Parse YAML value from string
YamlValue* parse_scalar(const char *value) {
    // Skip leading whitespace
    while (*value && isspace((unsigned char)*value)) value++;

    // Remove trailing whitespace
    char *trimmed = strdup(value);
    char *end = trimmed + strlen(trimmed) - 1;
    while (end > trimmed && isspace((unsigned char)*end)) *end-- = '\0';

    // Check type
    YamlValue *v;

    if (strcmp(trimmed, "null") == 0 || strcmp(trimmed, "~") == 0 || *trimmed == '\0') {
        v = create_value(YAML_NULL);
    } else if (strcmp(trimmed, "true") == 0 || strcmp(trimmed, "yes") == 0) {
        v = create_value(YAML_BOOL);
        v->data.bool_val = 1;
    } else if (strcmp(trimmed, "false") == 0 || strcmp(trimmed, "no") == 0) {
        v = create_value(YAML_BOOL);
        v->data.bool_val = 0;
    } else if ((*trimmed == '-' && isdigit((unsigned char)trimmed[1])) ||
               isdigit((unsigned char)*trimmed)) {
        v = create_value(YAML_NUMBER);
        v->data.num_val = strtod(trimmed, NULL);
    } else {
        v = create_value(YAML_STRING);
        // Remove quotes if present
        if ((*trimmed == '"' || *trimmed == '\'') && strlen(trimmed) >= 2) {
            v->data.str_val = strndup(trimmed + 1, strlen(trimmed) - 2);
        } else {
            v->data.str_val = strdup(trimmed);
        }
    }

    free(trimmed);
    return v;
}

// Simple YAML parser (handles basic structures)
YamlValue* parse_yaml(const char *yaml) {
    char *yaml_copy = strdup(yaml);
    char *lines[10000];
    int line_count = 0;

    // Split into lines
    char *line = strtok(yaml_copy, "\n");
    while (line && line_count < 10000) {
        lines[line_count++] = line;
        line = strtok(NULL, "\n");
    }

    if (line_count == 0) {
        free(yaml_copy);
        return create_value(YAML_NULL);
    }

    // Determine root type
    YamlValue *root = NULL;
    int base_indent = get_indent(lines[0]);

    for (int i = 0; i < line_count; i++) {
        const char *l = lines[i];
        int indent = get_indent(l);
        l += indent;

        if (*l == '\0' || *l == '#') continue;

        // Array item
        if (*l == '-') {
            if (!root) {
                root = create_value(YAML_ARRAY);
            }
            if (root->type == YAML_ARRAY) {
                l++;
                while (*l && isspace((unsigned char)*l)) l++;

                YamlValue *item = parse_scalar(l);
                root->data.array.count++;
                root->data.array.items = (YamlValue **)realloc(
                    root->data.array.items,
                    root->data.array.count * sizeof(YamlValue *)
                );
                root->data.array.items[root->data.array.count - 1] = item;
            }
        }
        // Key-value pair
        else {
            char *colon = strchr(l, ':');
            if (colon) {
                if (!root) {
                    root = create_value(YAML_OBJECT);
                }
                if (root->type == YAML_OBJECT) {
                    *colon = '\0';
                    const char *key = l;
                    const char *val = colon + 1;

                    while (*val && isspace((unsigned char)*val)) val++;

                    YamlValue *item = parse_scalar(val);
                    item->key = strdup(key);

                    root->data.object.count++;
                    root->data.object.items = (YamlValue **)realloc(
                        root->data.object.items,
                        root->data.object.count * sizeof(YamlValue *)
                    );
                    root->data.object.items[root->data.object.count - 1] = item;
                }
            }
        }
    }

    free(yaml_copy);
    return root ? root : create_value(YAML_NULL);
}

void free_yaml(YamlValue *v) {
    if (!v) return;

    free(v->key);

    if (v->type == YAML_STRING) {
        free(v->data.str_val);
    } else if (v->type == YAML_ARRAY) {
        for (int i = 0; i < v->data.array.count; i++) {
            free_yaml(v->data.array.items[i]);
        }
        free(v->data.array.items);
    } else if (v->type == YAML_OBJECT) {
        for (int i = 0; i < v->data.object.count; i++) {
            free_yaml(v->data.object.items[i]);
        }
        free(v->data.object.items);
    }

    free(v);
}

void print_yaml(YamlValue *v, int indent);

void print_indent(int n) {
    for (int i = 0; i < n; i++) printf("  ");
}

void print_yaml(YamlValue *v, int indent) {
    if (!v) {
        printf("null\n");
        return;
    }

    switch (v->type) {
        case YAML_NULL:
            printf("null\n");
            break;
        case YAML_BOOL:
            printf("%s\n", v->data.bool_val ? "true" : "false");
            break;
        case YAML_NUMBER:
            if (v->data.num_val == (int)v->data.num_val) {
                printf("%d\n", (int)v->data.num_val);
            } else {
                printf("%g\n", v->data.num_val);
            }
            break;
        case YAML_STRING:
            printf("%s\n", v->data.str_val);
            break;
        case YAML_ARRAY:
            printf("\n");
            for (int i = 0; i < v->data.array.count; i++) {
                print_indent(indent);
                printf("- ");
                print_yaml(v->data.array.items[i], indent + 1);
            }
            break;
        case YAML_OBJECT:
            if (indent > 0) printf("\n");
            for (int i = 0; i < v->data.object.count; i++) {
                YamlValue *item = v->data.object.items[i];
                print_indent(indent);
                printf("%s: ", item->key ? item->key : "");
                print_yaml(item, indent + 1);
            }
            break;
    }
}

// Apply filter
YamlValue* apply_filter(YamlValue *v, const char *filter) {
    if (!v || strcmp(filter, ".") == 0) return v;

    if (filter[0] == '.' && filter[1] != '[') {
        const char *key = filter + 1;
        if (v->type == YAML_OBJECT) {
            for (int i = 0; i < v->data.object.count; i++) {
                if (v->data.object.items[i]->key &&
                    strcmp(v->data.object.items[i]->key, key) == 0) {
                    return v->data.object.items[i];
                }
            }
        }
    }

    if (filter[0] == '.' && filter[1] == '[') {
        int idx = atoi(filter + 2);
        if (v->type == YAML_ARRAY && idx >= 0 && idx < v->data.array.count) {
            return v->data.array.items[idx];
        }
    }

    return NULL;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: yq <filter> <yaml>\n");
        fprintf(stderr, "Filters:\n");
        fprintf(stderr, "  .           Identity\n");
        fprintf(stderr, "  .key        Object key access\n");
        fprintf(stderr, "  .[n]        Array index\n");
        fprintf(stderr, "Or pipe yaml via stdin.\n");
        return 1;
    }

    const char *filter = argv[1];
    const char *yaml = (argc >= 3) ? argv[2] : NULL;
    char *stdin_buf = NULL;
    if (!yaml) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: yq <filter> <yaml>\nOr pipe yaml via stdin.\n");
            return 1;
        }
        yaml = stdin_buf;
    }

    YamlValue *root = parse_yaml(yaml);
    YamlValue *result = apply_filter(root, filter);

    print_yaml(result, 0);

    free_yaml(root);
    free(stdin_buf);
    return 0;
}
