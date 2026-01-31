/**
 * base64 - Encode and decode Base64 data
 *
 * Usage: base64 <encode|decode> <input>
 *
 * This is a simple WASM tool that demonstrates the custom tools system.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../stdin_read.h"

static const char b64_table[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encode a string to Base64.
 */
void encode(const char *input) {
    size_t len = strlen(input);
    size_t i;

    for (i = 0; i < len; i += 3) {
        unsigned char b0 = input[i];
        unsigned char b1 = (i + 1 < len) ? input[i + 1] : 0;
        unsigned char b2 = (i + 2 < len) ? input[i + 2] : 0;

        putchar(b64_table[b0 >> 2]);
        putchar(b64_table[((b0 & 0x03) << 4) | (b1 >> 4)]);
        putchar((i + 1 < len) ? b64_table[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=');
        putchar((i + 2 < len) ? b64_table[b2 & 0x3f] : '=');
    }
    putchar('\n');
}

/**
 * Reverse lookup table for base64 decoding.
 */
static int b64_decode_char(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;  // Invalid character or padding
}

/**
 * Decode a Base64 string.
 */
void decode(const char *input) {
    size_t len = strlen(input);
    size_t i;

    for (i = 0; i < len; i += 4) {
        int b0 = b64_decode_char(input[i]);
        int b1 = (i + 1 < len) ? b64_decode_char(input[i + 1]) : -1;
        int b2 = (i + 2 < len && input[i + 2] != '=') ? b64_decode_char(input[i + 2]) : 0;
        int b3 = (i + 3 < len && input[i + 3] != '=') ? b64_decode_char(input[i + 3]) : 0;

        if (b0 < 0 || b1 < 0) break;  // Invalid input

        putchar((b0 << 2) | (b1 >> 4));
        if (i + 2 < len && input[i + 2] != '=') {
            putchar(((b1 & 0x0f) << 4) | (b2 >> 2));
        }
        if (i + 3 < len && input[i + 3] != '=') {
            putchar(((b2 & 0x03) << 6) | b3);
        }
    }
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: base64 <encode|decode> [input]\n");
        return 1;
    }

    const char *input = (argc >= 3) ? argv[2] : NULL;
    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: base64 <encode|decode> <input>\nOr pipe input via stdin.\n");
            return 1;
        }
        input = stdin_buf;
    }

    if (strcmp(argv[1], "encode") == 0) {
        encode(input);
    } else if (strcmp(argv[1], "decode") == 0) {
        decode(input);
    } else {
        fprintf(stderr, "Unknown mode: %s\n", argv[1]);
        free(stdin_buf);
        return 1;
    }

    free(stdin_buf);
    return 0;
}
