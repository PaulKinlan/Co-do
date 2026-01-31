/**
 * head - Output first N lines of input
 * Usage: head [-n NUM] <text>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../stdin_read.h"

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

    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) { fprintf(stderr, "Usage: head [-n NUM] <text>\nOr pipe input via stdin.\n"); return 1; }
        input = stdin_buf;
    }

    int lines = 0;
    for (const char *p = input; *p && lines < num_lines; p++) {
        putchar(*p);
        if (*p == '\n') lines++;
    }

    // Add newline if input doesn't end with one
    if (input[0] && input[strlen(input)-1] != '\n' && lines < num_lines) {
        putchar('\n');
    }

    free(stdin_buf);
    return 0;
}
