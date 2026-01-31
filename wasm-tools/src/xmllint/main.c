/**
 * xmllint - XML validation and query
 * Usage: xmllint [--xpath EXPR] <xml>
 * Options: --xpath (evaluate XPath expression)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "../stdin_read.h"

#define MAX_DEPTH 100

typedef struct XmlNode {
    char *tag;
    char *text;
    char **attr_names;
    char **attr_values;
    int attr_count;
    struct XmlNode **children;
    int child_count;
    struct XmlNode *parent;
} XmlNode;

XmlNode* create_node(const char *tag) {
    XmlNode *node = (XmlNode *)calloc(1, sizeof(XmlNode));
    if (tag) node->tag = strdup(tag);
    return node;
}

void free_node(XmlNode *node) {
    if (!node) return;

    free(node->tag);
    free(node->text);

    for (int i = 0; i < node->attr_count; i++) {
        free(node->attr_names[i]);
        free(node->attr_values[i]);
    }
    free(node->attr_names);
    free(node->attr_values);

    for (int i = 0; i < node->child_count; i++) {
        free_node(node->children[i]);
    }
    free(node->children);

    free(node);
}

void add_child(XmlNode *parent, XmlNode *child) {
    parent->child_count++;
    parent->children = (XmlNode **)realloc(
        parent->children,
        parent->child_count * sizeof(XmlNode *)
    );
    parent->children[parent->child_count - 1] = child;
    child->parent = parent;
}

// Simple XML parser
XmlNode* parse_xml(const char *xml) {
    XmlNode *root = NULL;
    XmlNode *current = NULL;
    const char *p = xml;

    while (*p) {
        // Skip whitespace
        while (*p && isspace((unsigned char)*p)) p++;
        if (!*p) break;

        // XML declaration or DOCTYPE - skip
        if (strncmp(p, "<?", 2) == 0 || strncmp(p, "<!", 2) == 0) {
            p = strchr(p, '>');
            if (p) p++;
            continue;
        }

        // Closing tag
        if (strncmp(p, "</", 2) == 0) {
            p += 2;
            while (*p && *p != '>') p++;
            if (*p) p++;
            if (current && current->parent) {
                current = current->parent;
            }
            continue;
        }

        // Opening tag
        if (*p == '<') {
            p++;

            // Get tag name
            const char *tag_start = p;
            while (*p && !isspace((unsigned char)*p) && *p != '>' && *p != '/') p++;

            char tag[256];
            size_t tag_len = p - tag_start;
            if (tag_len >= sizeof(tag)) tag_len = sizeof(tag) - 1;
            strncpy(tag, tag_start, tag_len);
            tag[tag_len] = '\0';

            XmlNode *node = create_node(tag);

            // Parse attributes
            while (*p && *p != '>' && *p != '/') {
                while (*p && isspace((unsigned char)*p)) p++;
                if (*p == '>' || *p == '/') break;

                // Attribute name
                const char *name_start = p;
                while (*p && *p != '=' && !isspace((unsigned char)*p)) p++;

                char name[256];
                size_t name_len = p - name_start;
                if (name_len >= sizeof(name)) name_len = sizeof(name) - 1;
                strncpy(name, name_start, name_len);
                name[name_len] = '\0';

                // Skip =
                while (*p && (*p == '=' || isspace((unsigned char)*p))) p++;

                // Attribute value
                char quote = *p;
                if (quote == '"' || quote == '\'') {
                    p++;
                    const char *val_start = p;
                    while (*p && *p != quote) p++;

                    char value[1024];
                    size_t val_len = p - val_start;
                    if (val_len >= sizeof(value)) val_len = sizeof(value) - 1;
                    strncpy(value, val_start, val_len);
                    value[val_len] = '\0';

                    // Add attribute
                    node->attr_count++;
                    node->attr_names = (char **)realloc(
                        node->attr_names,
                        node->attr_count * sizeof(char *)
                    );
                    node->attr_values = (char **)realloc(
                        node->attr_values,
                        node->attr_count * sizeof(char *)
                    );
                    node->attr_names[node->attr_count - 1] = strdup(name);
                    node->attr_values[node->attr_count - 1] = strdup(value);

                    if (*p == quote) p++;
                }
            }

            // Self-closing tag
            int self_closing = 0;
            if (*p == '/') {
                self_closing = 1;
                p++;
            }
            if (*p == '>') p++;

            if (!root) {
                root = node;
                current = node;
            } else if (current) {
                add_child(current, node);
                if (!self_closing) {
                    current = node;
                }
            }

            continue;
        }

        // Text content
        if (current) {
            const char *text_start = p;
            while (*p && *p != '<') p++;

            size_t text_len = p - text_start;
            char *text = (char *)malloc(text_len + 1);
            strncpy(text, text_start, text_len);
            text[text_len] = '\0';

            // Trim
            char *t = text;
            while (*t && isspace((unsigned char)*t)) t++;
            if (*t) {
                if (current->text) {
                    size_t old_len = strlen(current->text);
                    current->text = (char *)realloc(current->text, old_len + strlen(t) + 2);
                    strcat(current->text, " ");
                    strcat(current->text, t);
                } else {
                    current->text = strdup(t);
                }
            }
            free(text);
        } else {
            p++;
        }
    }

    return root;
}

// Print XML
void print_xml(XmlNode *node, int indent) {
    if (!node) return;

    for (int i = 0; i < indent; i++) printf("  ");

    printf("<%s", node->tag);

    for (int i = 0; i < node->attr_count; i++) {
        printf(" %s=\"%s\"", node->attr_names[i], node->attr_values[i]);
    }

    if (node->child_count == 0 && !node->text) {
        printf("/>\n");
        return;
    }

    printf(">");

    if (node->text && node->child_count == 0) {
        printf("%s</%s>\n", node->text, node->tag);
        return;
    }

    printf("\n");

    if (node->text) {
        for (int i = 0; i < indent + 1; i++) printf("  ");
        printf("%s\n", node->text);
    }

    for (int i = 0; i < node->child_count; i++) {
        print_xml(node->children[i], indent + 1);
    }

    for (int i = 0; i < indent; i++) printf("  ");
    printf("</%s>\n", node->tag);
}

// Simple XPath evaluation
void xpath_query(XmlNode *node, const char *xpath) {
    if (!node || !xpath) return;

    // Handle /tag/subtag format
    if (*xpath == '/') xpath++;

    char current_tag[256];
    const char *slash = strchr(xpath, '/');

    if (slash) {
        size_t len = slash - xpath;
        if (len >= sizeof(current_tag)) len = sizeof(current_tag) - 1;
        strncpy(current_tag, xpath, len);
        current_tag[len] = '\0';

        // Match current tag
        if (strcmp(node->tag, current_tag) == 0) {
            for (int i = 0; i < node->child_count; i++) {
                xpath_query(node->children[i], slash);
            }
        }
    } else {
        // Final tag - print matches
        if (strcmp(node->tag, xpath) == 0) {
            if (node->text) {
                printf("%s\n", node->text);
            } else {
                print_xml(node, 0);
            }
        }

        // Search children
        for (int i = 0; i < node->child_count; i++) {
            xpath_query(node->children[i], xpath);
        }
    }
}

int main(int argc, char **argv) {
    const char *xpath = NULL;
    const char *xml = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--xpath") == 0 && i + 1 < argc) {
            xpath = argv[++i];
        } else {
            xml = argv[i];
        }
    }

    char *stdin_buf = NULL;
    if (!xml) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: xmllint [--xpath EXPR] <xml>\nOr pipe input via stdin.\n");
            return 1;
        }
        xml = stdin_buf;
    }

    XmlNode *root = parse_xml(xml);

    if (!root) {
        fprintf(stderr, "Error: Failed to parse XML\n");
        free(stdin_buf);
        return 1;
    }

    if (xpath) {
        xpath_query(root, xpath);
    } else {
        print_xml(root, 0);
    }

    free_node(root);
    free(stdin_buf);
    return 0;
}
