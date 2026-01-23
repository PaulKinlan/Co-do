/**
 * diff - Compare files line by line
 * Usage: diff <text1> <text2>
 * Output: Unified diff format
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

void free_lines(FileLines *f) {
    for (int i = 0; i < f->count; i++) {
        free(f->lines[i]);
    }
    f->count = 0;
}

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

// Simple LCS-based diff
// Returns number of common lines
int lcs_length(FileLines *a, FileLines *b, int **dp) {
    int m = a->count;
    int n = b->count;

    // Allocate DP table
    *dp = (int *)calloc((m + 1) * (n + 1), sizeof(int));

    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (strcmp(a->lines[i-1], b->lines[j-1]) == 0) {
                (*dp)[i * (n + 1) + j] = (*dp)[(i-1) * (n + 1) + (j-1)] + 1;
            } else {
                int up = (*dp)[(i-1) * (n + 1) + j];
                int left = (*dp)[i * (n + 1) + (j-1)];
                (*dp)[i * (n + 1) + j] = (up > left) ? up : left;
            }
        }
    }

    return (*dp)[m * (n + 1) + n];
}

void print_diff(FileLines *a, FileLines *b) {
    int *dp;
    lcs_length(a, b, &dp);

    int m = a->count;
    int n = b->count;

    // Backtrack to find differences
    typedef struct { int op; int ai; int bi; } DiffOp;
    DiffOp *ops = (DiffOp *)malloc((m + n + 1) * sizeof(DiffOp));
    int op_count = 0;

    int i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && strcmp(a->lines[i-1], b->lines[j-1]) == 0) {
            ops[op_count].op = ' ';
            ops[op_count].ai = i - 1;
            ops[op_count].bi = j - 1;
            op_count++;
            i--; j--;
        } else if (j > 0 && (i == 0 || dp[(i) * (n + 1) + (j-1)] >= dp[(i-1) * (n + 1) + j])) {
            ops[op_count].op = '+';
            ops[op_count].ai = -1;
            ops[op_count].bi = j - 1;
            op_count++;
            j--;
        } else {
            ops[op_count].op = '-';
            ops[op_count].ai = i - 1;
            ops[op_count].bi = -1;
            op_count++;
            i--;
        }
    }

    free(dp);

    // Print header
    printf("--- a\n");
    printf("+++ b\n");

    // Find hunks and print
    int hunk_start = -1;
    int hunk_end = -1;

    for (int k = op_count - 1; k >= 0; k--) {
        if (ops[k].op != ' ') {
            if (hunk_start < 0) hunk_start = k;
            hunk_end = k;
        } else if (hunk_start >= 0) {
            // End of hunk, print it
            int context_before = (hunk_start < op_count - 1) ? 3 : 0;
            int context_after = (hunk_end > 0) ? 3 : 0;

            int start_idx = hunk_start + context_before;
            if (start_idx >= op_count) start_idx = op_count - 1;

            int end_idx = hunk_end - context_after;
            if (end_idx < 0) end_idx = 0;

            // Calculate line numbers
            int a_start = 1, a_count = 0;
            int b_start = 1, b_count = 0;

            for (int x = op_count - 1; x >= end_idx; x--) {
                if (x == start_idx) {
                    a_start = (ops[x].ai >= 0) ? ops[x].ai + 1 : 1;
                    b_start = (ops[x].bi >= 0) ? ops[x].bi + 1 : 1;
                }
                if (x <= start_idx && x >= end_idx) {
                    if (ops[x].op == ' ' || ops[x].op == '-') a_count++;
                    if (ops[x].op == ' ' || ops[x].op == '+') b_count++;
                }
            }

            printf("@@ -%d,%d +%d,%d @@\n", a_start, a_count, b_start, b_count);

            for (int x = start_idx; x >= end_idx; x--) {
                if (ops[x].op == ' ') {
                    printf(" %s\n", a->lines[ops[x].ai]);
                } else if (ops[x].op == '-') {
                    printf("-%s\n", a->lines[ops[x].ai]);
                } else if (ops[x].op == '+') {
                    printf("+%s\n", b->lines[ops[x].bi]);
                }
            }

            hunk_start = -1;
            hunk_end = -1;
        }
    }

    // Print remaining hunk
    if (hunk_start >= 0) {
        int a_start = 1, a_count = 0;
        int b_start = 1, b_count = 0;

        for (int x = op_count - 1; x >= 0; x--) {
            if (ops[x].op == ' ' || ops[x].op == '-') a_count++;
            if (ops[x].op == ' ' || ops[x].op == '+') b_count++;
        }

        if (op_count > 0) {
            a_start = (ops[op_count-1].ai >= 0) ? ops[op_count-1].ai + 1 : 1;
            b_start = (ops[op_count-1].bi >= 0) ? ops[op_count-1].bi + 1 : 1;
        }

        printf("@@ -%d,%d +%d,%d @@\n", a_start, a_count, b_start, b_count);

        for (int x = op_count - 1; x >= 0; x--) {
            if (ops[x].op == ' ') {
                printf(" %s\n", a->lines[ops[x].ai]);
            } else if (ops[x].op == '-') {
                printf("-%s\n", a->lines[ops[x].ai]);
            } else if (ops[x].op == '+') {
                printf("+%s\n", b->lines[ops[x].bi]);
            }
        }
    }

    free(ops);
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: diff <text1> <text2>\n");
        return 1;
    }

    FileLines a, b;
    parse_lines(argv[1], &a);
    parse_lines(argv[2], &b);

    print_diff(&a, &b);

    free_lines(&a);
    free_lines(&b);

    return 0;
}
