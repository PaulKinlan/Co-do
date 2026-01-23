/**
 * tree - Display directory structure (text representation)
 * Usage: tree <directory-listing>
 * Input: Newline-separated file paths
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_DEPTH 64
#define MAX_LINE 4096
#define MAX_LINES 10000

typedef struct TreeNode {
    char name[256];
    int is_dir;
    struct TreeNode *children;
    struct TreeNode *next;
    int child_count;
} TreeNode;

TreeNode* create_node(const char *name, int is_dir) {
    TreeNode *node = (TreeNode *)calloc(1, sizeof(TreeNode));
    strncpy(node->name, name, 255);
    node->is_dir = is_dir;
    return node;
}

void free_tree(TreeNode *node) {
    if (!node) return;
    TreeNode *child = node->children;
    while (child) {
        TreeNode *next = child->next;
        free_tree(child);
        child = next;
    }
    free(node);
}

TreeNode* find_or_create_child(TreeNode *parent, const char *name, int is_dir) {
    TreeNode *child = parent->children;
    TreeNode *last = NULL;

    while (child) {
        if (strcmp(child->name, name) == 0) {
            return child;
        }
        last = child;
        child = child->next;
    }

    // Create new child
    TreeNode *new_child = create_node(name, is_dir);
    if (last) {
        last->next = new_child;
    } else {
        parent->children = new_child;
    }
    parent->child_count++;

    return new_child;
}

void insert_path(TreeNode *root, const char *path) {
    char *path_copy = strdup(path);
    char *token = strtok(path_copy, "/\\");
    TreeNode *current = root;

    while (token) {
        char *next_token = strtok(NULL, "/\\");
        int is_dir = (next_token != NULL);
        current = find_or_create_child(current, token, is_dir);
        token = next_token;
    }

    free(path_copy);
}

void print_tree(TreeNode *node, int depth, int *is_last, int show_root) {
    if (show_root && depth >= 0) {
        // Print prefix
        for (int i = 0; i < depth; i++) {
            printf("%s", is_last[i] ? "    " : "│   ");
        }

        if (depth >= 0) {
            printf("%s", is_last[depth] ? "└── " : "├── ");
        }

        printf("%s%s\n", node->name, node->is_dir ? "/" : "");
    }

    // Print children
    TreeNode *child = node->children;
    int child_idx = 0;
    while (child) {
        is_last[depth + 1] = (child->next == NULL);
        print_tree(child, depth + 1, is_last, 1);
        child = child->next;
        child_idx++;
    }
}

void count_tree(TreeNode *node, int *dirs, int *files) {
    TreeNode *child = node->children;
    while (child) {
        if (child->is_dir || child->child_count > 0) {
            (*dirs)++;
        } else {
            (*files)++;
        }
        count_tree(child, dirs, files);
        child = child->next;
    }
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: tree <directory-listing>\n");
        fprintf(stderr, "Input: Newline-separated file paths\n");
        return 1;
    }

    const char *input = argv[1];

    // Create root node
    TreeNode *root = create_node(".", 1);

    // Parse input (newline-separated paths)
    char *input_copy = strdup(input);
    char *line = strtok(input_copy, "\n");

    while (line) {
        // Skip empty lines
        while (*line == ' ' || *line == '\t') line++;
        if (*line && *line != '\n') {
            // Remove trailing whitespace
            char *end = line + strlen(line) - 1;
            while (end > line && (*end == ' ' || *end == '\t' || *end == '\r')) {
                *end-- = '\0';
            }
            if (*line) {
                insert_path(root, line);
            }
        }
        line = strtok(NULL, "\n");
    }

    free(input_copy);

    // Print tree
    printf(".\n");
    int is_last[MAX_DEPTH] = {0};
    TreeNode *child = root->children;
    while (child) {
        is_last[0] = (child->next == NULL);
        print_tree(child, 0, is_last, 1);
        child = child->next;
    }

    // Count and print summary
    int dirs = 0, files = 0;
    count_tree(root, &dirs, &files);
    printf("\n%d directories, %d files\n", dirs, files);

    free_tree(root);
    return 0;
}
