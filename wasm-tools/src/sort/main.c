/**
 * sort - Sort lines of text
 * Usage: sort [-r] [-n] <text>
 * Options: -r (reverse), -n (numeric sort)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINES 10000
#define MAX_LINE_LEN 4096

static char *lines[MAX_LINES];
static int num_lines = 0;
static int reverse_sort = 0;
static int numeric_sort = 0;

int compare_strings(const void *a, const void *b) {
    const char *s1 = *(const char **)a;
    const char *s2 = *(const char **)b;
    int result;

    if (numeric_sort) {
        result = atoi(s1) - atoi(s2);
    } else {
        result = strcmp(s1, s2);
    }

    return reverse_sort ? -result : result;
}

int main(int argc, char **argv) {
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-r") == 0) {
            reverse_sort = 1;
        } else if (strcmp(argv[i], "-n") == 0) {
            numeric_sort = 1;
        } else if (argv[i][0] != '-') {
            input = argv[i];
        }
    }

    if (!input) {
        fprintf(stderr, "Usage: sort [-r] [-n] <text>\n");
        return 1;
    }

    // Split input into lines
    char *input_copy = strdup(input);
    char *line = strtok(input_copy, "\n");

    while (line && num_lines < MAX_LINES) {
        lines[num_lines++] = line;
        line = strtok(NULL, "\n");
    }

    // Sort
    qsort(lines, num_lines, sizeof(char *), compare_strings);

    // Output
    for (int i = 0; i < num_lines; i++) {
        printf("%s\n", lines[i]);
    }

    free(input_copy);
    return 0;
}
