/**
 * cut - Extract columns from text
 * Usage: cut -d DELIMITER -f FIELD <text>
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../stdin_read.h"

int main(int argc, char **argv) {
    char delimiter = '\t';  // Default delimiter
    int field = 1;
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-d") == 0 && i + 1 < argc) {
            delimiter = argv[++i][0];
        } else if (strcmp(argv[i], "-f") == 0 && i + 1 < argc) {
            field = atoi(argv[++i]);
        } else if (argv[i][0] != '-') {
            input = argv[i];
        }
    }

    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: cut -d DELIMITER -f FIELD <text>\n");
            return 1;
        }
        input = stdin_buf;
    }

    if (field < 1) {
        fprintf(stderr, "Usage: cut -d DELIMITER -f FIELD <text>\n");
        free(stdin_buf);
        return 1;
    }

    // Process each line
    const char *line_start = input;
    while (*line_start) {
        // Find end of line
        const char *line_end = line_start;
        while (*line_end && *line_end != '\n') line_end++;

        // Find the requested field
        int current_field = 1;
        const char *field_start = line_start;
        const char *field_end = line_start;

        while (field_end < line_end) {
            if (*field_end == delimiter) {
                if (current_field == field) break;
                current_field++;
                field_start = field_end + 1;
            }
            field_end++;
        }

        // Output field if found
        if (current_field == field) {
            while (field_start < field_end && *field_start != delimiter) {
                putchar(*field_start++);
            }
        }
        putchar('\n');

        // Move to next line
        line_start = *line_end ? line_end + 1 : line_end;
    }

    free(stdin_buf);
    return 0;
}
