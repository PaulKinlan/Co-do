/**
 * head - Output first N lines of input
 * Usage: head [-n NUM] <text>
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
        fprintf(stderr, "Usage: head [-n NUM] <text>\n");
        return 1;
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

    return 0;
}
