/**
 * csvtool - CSV manipulation utilities
 * Usage: csvtool <command> [options] <csv-data>
 * Commands: col, head, tail, width, height, cat
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../stdin_read.h"

#define MAX_COLS 1024
#define MAX_LINE 65536

typedef struct {
    char *fields[MAX_COLS];
    int field_count;
} CSVRow;

// Parse a CSV line into fields
int parse_csv_line(char *line, CSVRow *row) {
    row->field_count = 0;
    char *p = line;
    int in_quotes = 0;
    char *field_start = p;

    while (*p && row->field_count < MAX_COLS) {
        if (*p == '"') {
            in_quotes = !in_quotes;
        } else if (*p == ',' && !in_quotes) {
            *p = '\0';
            row->fields[row->field_count++] = field_start;
            field_start = p + 1;
        }
        p++;
    }

    // Add last field
    if (field_start <= p && row->field_count < MAX_COLS) {
        // Remove trailing newline/carriage return
        char *end = p - 1;
        while (end >= field_start && (*end == '\n' || *end == '\r')) {
            *end-- = '\0';
        }
        row->fields[row->field_count++] = field_start;
    }

    return row->field_count;
}

// Print a CSV row
void print_row(CSVRow *row) {
    for (int i = 0; i < row->field_count; i++) {
        if (i > 0) putchar(',');

        // Check if field needs quoting
        const char *field = row->fields[i];
        int needs_quotes = 0;
        for (const char *c = field; *c; c++) {
            if (*c == ',' || *c == '"' || *c == '\n') {
                needs_quotes = 1;
                break;
            }
        }

        if (needs_quotes) {
            putchar('"');
            for (const char *c = field; *c; c++) {
                if (*c == '"') putchar('"');
                putchar(*c);
            }
            putchar('"');
        } else {
            printf("%s", field);
        }
    }
    putchar('\n');
}

// Command: col - Extract specific columns
void cmd_col(const char *cols, char *data) {
    // Parse column numbers
    int col_nums[MAX_COLS];
    int num_cols = 0;

    char *cols_copy = strdup(cols);
    char *token = strtok(cols_copy, ",");
    while (token && num_cols < MAX_COLS) {
        col_nums[num_cols++] = atoi(token) - 1;  // Convert to 0-indexed
        token = strtok(NULL, ",");
    }
    free(cols_copy);

    // Process lines
    char *line = strtok(data, "\n");
    while (line) {
        CSVRow row;
        char *line_copy = strdup(line);
        parse_csv_line(line_copy, &row);

        // Print selected columns
        for (int i = 0; i < num_cols; i++) {
            if (i > 0) putchar(',');
            int col = col_nums[i];
            if (col >= 0 && col < row.field_count) {
                printf("%s", row.fields[col]);
            }
        }
        putchar('\n');

        free(line_copy);
        line = strtok(NULL, "\n");
    }
}

// Command: head - First N rows
void cmd_head(int n, char *data) {
    int count = 0;
    char *line = strtok(data, "\n");
    while (line && count < n) {
        printf("%s\n", line);
        count++;
        line = strtok(NULL, "\n");
    }
}

// Command: tail - Last N rows
void cmd_tail(int n, char *data) {
    // Count lines
    int total_lines = 0;
    char *data_copy = strdup(data);
    char *line = strtok(data_copy, "\n");
    while (line) {
        total_lines++;
        line = strtok(NULL, "\n");
    }
    free(data_copy);

    // Skip first (total - n) lines
    int skip = total_lines - n;
    if (skip < 0) skip = 0;

    data_copy = strdup(data);
    int count = 0;
    line = strtok(data_copy, "\n");
    while (line) {
        if (count >= skip) {
            printf("%s\n", line);
        }
        count++;
        line = strtok(NULL, "\n");
    }
    free(data_copy);
}

// Command: width - Number of columns
void cmd_width(char *data) {
    char *line = strtok(data, "\n");
    if (line) {
        char *line_copy = strdup(line);
        CSVRow row;
        parse_csv_line(line_copy, &row);
        printf("%d\n", row.field_count);
        free(line_copy);
    } else {
        printf("0\n");
    }
}

// Command: height - Number of rows
void cmd_height(char *data) {
    int count = 0;
    char *line = strtok(data, "\n");
    while (line) {
        if (*line) count++;
        line = strtok(NULL, "\n");
    }
    printf("%d\n", count);
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: csvtool <command> [options] <csv-data>\n");
        fprintf(stderr, "Commands:\n");
        fprintf(stderr, "  col 1,2,3   Extract columns 1, 2, 3\n");
        fprintf(stderr, "  head N      First N rows\n");
        fprintf(stderr, "  tail N      Last N rows\n");
        fprintf(stderr, "  width       Number of columns\n");
        fprintf(stderr, "  height      Number of rows\n");
        fprintf(stderr, "Or pipe csv-data via stdin.\n");
        return 1;
    }

    const char *cmd = argv[1];
    char *data = NULL;
    const char *option = NULL;
    char *stdin_buf = NULL;

    // Find data and options
    if (strcmp(cmd, "col") == 0 || strcmp(cmd, "head") == 0 || strcmp(cmd, "tail") == 0) {
        if (argc < 3) {
            fprintf(stderr, "Error: Command '%s' requires an option and data\n", cmd);
            return 1;
        }
        option = argv[2];
        data = (argc >= 4) ? strdup(argv[3]) : NULL;
    } else {
        data = (argc >= 3) ? strdup(argv[2]) : NULL;
    }

    if (!data) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: csvtool <command> [options] <csv-data>\nOr pipe csv-data via stdin.\n");
            return 1;
        }
        data = strdup(stdin_buf);
    }

    if (strcmp(cmd, "col") == 0) {
        cmd_col(option, data);
    } else if (strcmp(cmd, "head") == 0) {
        cmd_head(atoi(option), data);
    } else if (strcmp(cmd, "tail") == 0) {
        cmd_tail(atoi(option), data);
    } else if (strcmp(cmd, "width") == 0) {
        cmd_width(data);
    } else if (strcmp(cmd, "height") == 0) {
        cmd_height(data);
    } else {
        fprintf(stderr, "Error: Unknown command '%s'\n", cmd);
        free(data);
        return 1;
    }

    free(stdin_buf);
    free(data);
    return 0;
}
