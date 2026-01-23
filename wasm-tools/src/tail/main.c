/**
 * tail - Output last N lines of input
 * Usage: tail [-n NUM] <text>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    int num_lines = 10;  // Default
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) {
            num_lines = atoi(argv[++i]);
        } else if (argv[i][0] != '-') {
            input = argv[i];
        }
    }

    if (!input) {
        fprintf(stderr, "Usage: tail [-n NUM] <text>\n");
        return 1;
    }

    // Count total lines
    int total_lines = 0;
    for (const char *p = input; *p; p++) {
        if (*p == '\n') total_lines++;
    }
    // Count last line if no trailing newline
    size_t len = strlen(input);
    if (len > 0 && input[len-1] != '\n') total_lines++;

    // Find starting position
    int skip_lines = total_lines - num_lines;
    if (skip_lines < 0) skip_lines = 0;

    int current_line = 0;
    for (const char *p = input; *p; p++) {
        if (current_line >= skip_lines) {
            putchar(*p);
        }
        if (*p == '\n') current_line++;
    }

    // Add newline if needed
    if (len > 0 && input[len-1] != '\n') {
        putchar('\n');
    }

    return 0;
}
