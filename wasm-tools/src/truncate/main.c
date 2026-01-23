/**
 * truncate - Shrink or extend file size (output action for external execution)
 * Usage: truncate -s SIZE <filename>
 * Note: WASM cannot modify filesystem directly, outputs the action to perform
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

long long parse_size(const char *size_str) {
    char *endptr;
    long long size = strtoll(size_str, &endptr, 10);

    // Handle size suffixes
    if (*endptr) {
        switch (toupper((unsigned char)*endptr)) {
            case 'K':
                size *= 1024;
                break;
            case 'M':
                size *= 1024 * 1024;
                break;
            case 'G':
                size *= 1024LL * 1024 * 1024;
                break;
            case 'T':
                size *= 1024LL * 1024 * 1024 * 1024;
                break;
        }
    }

    return size;
}

void format_size(long long size, char *buf, size_t buf_len) {
    const char *units[] = {"B", "KB", "MB", "GB", "TB"};
    int unit_idx = 0;
    double display_size = (double)size;

    while (display_size >= 1024 && unit_idx < 4) {
        display_size /= 1024;
        unit_idx++;
    }

    if (unit_idx == 0) {
        snprintf(buf, buf_len, "%lld %s", size, units[unit_idx]);
    } else {
        snprintf(buf, buf_len, "%.2f %s", display_size, units[unit_idx]);
    }
}

int main(int argc, char **argv) {
    const char *size_str = NULL;
    const char *filename = NULL;
    int relative = 0;
    char relative_op = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) {
            size_str = argv[++i];
        } else if (argv[i][0] != '-') {
            filename = argv[i];
        }
    }

    if (!size_str || !filename) {
        fprintf(stderr, "Usage: truncate -s SIZE <filename>\n");
        fprintf(stderr, "SIZE can be:\n");
        fprintf(stderr, "  N      - Set size to N bytes\n");
        fprintf(stderr, "  +N     - Extend by N bytes\n");
        fprintf(stderr, "  -N     - Shrink by N bytes\n");
        fprintf(stderr, "  NK/NM/NG - Use K/M/G suffix for kilobytes/megabytes/gigabytes\n");
        return 1;
    }

    // Check for relative size
    if (size_str[0] == '+' || size_str[0] == '-') {
        relative = 1;
        relative_op = size_str[0];
        size_str++;
    }

    long long size = parse_size(size_str);
    if (relative_op == '-') {
        size = -size;
    }

    char size_human[64];
    format_size(size < 0 ? -size : size, size_human, sizeof(size_human));

    // Output action description
    printf("Truncate: %s\n", filename);

    if (relative) {
        if (size >= 0) {
            printf("Action: extend by %lld bytes (%s)\n", size, size_human);
        } else {
            printf("Action: shrink by %lld bytes (%s)\n", -size, size_human);
        }
    } else {
        printf("Action: set size to %lld bytes (%s)\n", size, size_human);
    }

    printf("Size: %lld\n", size);
    printf("Relative: %s\n", relative ? "yes" : "no");

    return 0;
}
