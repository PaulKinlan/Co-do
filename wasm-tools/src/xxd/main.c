/**
 * xxd - Create hex dump
 * Usage: xxd [-r] [-p] <text>
 * Options: -r (reverse/decode), -p (plain hex output)
 */

#include <stdio.h>
#include <string.h>
#include <ctype.h>

int hex_to_int(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

int main(int argc, char **argv) {
    int reverse = 0;
    int plain = 0;
    const char *input = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-r") == 0) {
            reverse = 1;
        } else if (strcmp(argv[i], "-p") == 0) {
            plain = 1;
        } else if (argv[i][0] != '-') {
            input = argv[i];
        }
    }

    if (!input) {
        fprintf(stderr, "Usage: xxd [-r] [-p] <text>\n");
        return 1;
    }

    if (reverse) {
        // Decode hex to binary
        const char *p = input;
        while (*p) {
            // Skip whitespace
            while (*p && isspace((unsigned char)*p)) p++;
            if (!*p) break;

            int hi = hex_to_int(*p++);
            if (hi < 0) continue;

            while (*p && isspace((unsigned char)*p)) p++;
            if (!*p) break;

            int lo = hex_to_int(*p++);
            if (lo < 0) continue;

            putchar((hi << 4) | lo);
        }
    } else if (plain) {
        // Plain hex output
        for (const char *p = input; *p; p++) {
            printf("%02x", (unsigned char)*p);
        }
        printf("\n");
    } else {
        // Traditional xxd format
        size_t len = strlen(input);
        for (size_t i = 0; i < len; i += 16) {
            printf("%08zx: ", i);

            // Hex
            for (size_t j = 0; j < 16; j++) {
                if (i + j < len) {
                    printf("%02x", (unsigned char)input[i + j]);
                } else {
                    printf("  ");
                }
                if (j % 2 == 1) printf(" ");
            }

            printf(" ");

            // ASCII
            for (size_t j = 0; j < 16 && i + j < len; j++) {
                char c = input[i + j];
                putchar(isprint((unsigned char)c) ? c : '.');
            }

            printf("\n");
        }
    }

    return 0;
}
