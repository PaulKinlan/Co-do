/**
 * patch - Apply diff patches (unified format)
 * Usage: patch <original-text> <patch>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 10000
#define MAX_LINE_LEN 4096

typedef struct {
    char *lines[MAX_LINES];
    int count;
} FileLines;

void parse_lines(const char *text, FileLines *f) {
    f->count = 0;
    char *text_copy = strdup(text);
    char *line = strtok(text_copy, "\n");

    while (line && f->count < MAX_LINES) {
        f->lines[f->count++] = strdup(line);
        line = strtok(NULL, "\n");
    }

    free(text_copy);
}

void free_lines(FileLines *f) {
    for (int i = 0; i < f->count; i++) {
        free(f->lines[i]);
    }
    f->count = 0;
}

// Parse hunk header @@ -start,count +start,count @@
int parse_hunk_header(const char *line, int *old_start, int *old_count, int *new_start, int *new_count) {
    return sscanf(line, "@@ -%d,%d +%d,%d @@", old_start, old_count, new_start, new_count) >= 2;
}

// Apply patch to original
void apply_patch(FileLines *original, FileLines *patch) {
    FileLines result;
    result.count = 0;

    int orig_idx = 0;
    int patch_idx = 0;

    // Skip patch header lines (--- and +++)
    while (patch_idx < patch->count) {
        if (strncmp(patch->lines[patch_idx], "---", 3) == 0 ||
            strncmp(patch->lines[patch_idx], "+++", 3) == 0) {
            patch_idx++;
        } else {
            break;
        }
    }

    while (patch_idx < patch->count) {
        char *pline = patch->lines[patch_idx];

        // Hunk header
        if (strncmp(pline, "@@", 2) == 0) {
            int old_start, old_count, new_start, new_count;
            if (parse_hunk_header(pline, &old_start, &old_count, &new_start, &new_count)) {
                // Copy unchanged lines before this hunk
                while (orig_idx < old_start - 1 && orig_idx < original->count) {
                    if (result.count < MAX_LINES) {
                        result.lines[result.count++] = strdup(original->lines[orig_idx]);
                    }
                    orig_idx++;
                }
            }
            patch_idx++;
            continue;
        }

        // Context line (space prefix)
        if (pline[0] == ' ') {
            if (result.count < MAX_LINES) {
                result.lines[result.count++] = strdup(pline + 1);
            }
            orig_idx++;
            patch_idx++;
            continue;
        }

        // Removed line (minus prefix)
        if (pline[0] == '-') {
            // Skip this line from original
            orig_idx++;
            patch_idx++;
            continue;
        }

        // Added line (plus prefix)
        if (pline[0] == '+') {
            if (result.count < MAX_LINES) {
                result.lines[result.count++] = strdup(pline + 1);
            }
            patch_idx++;
            continue;
        }

        // Unknown line, skip
        patch_idx++;
    }

    // Copy remaining original lines
    while (orig_idx < original->count) {
        if (result.count < MAX_LINES) {
            result.lines[result.count++] = strdup(original->lines[orig_idx]);
        }
        orig_idx++;
    }

    // Output result
    for (int i = 0; i < result.count; i++) {
        printf("%s\n", result.lines[i]);
    }

    free_lines(&result);
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: patch <original-text> <patch>\n");
        fprintf(stderr, "Applies a unified diff patch to the original text\n");
        return 1;
    }

    FileLines original, patch;
    parse_lines(argv[1], &original);
    parse_lines(argv[2], &patch);

    apply_patch(&original, &patch);

    free_lines(&original);
    free_lines(&patch);

    return 0;
}
