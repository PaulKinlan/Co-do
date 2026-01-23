/**
 * jwt - Encode/decode JWT tokens (without signature verification)
 * Usage: jwt <encode|decode> <payload|token>
 * Note: This tool does NOT verify signatures - for inspection only
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Base64URL alphabet
static const char b64url_table[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Base64URL encode
void base64url_encode(const unsigned char *data, size_t len, char *output) {
    size_t i, j = 0;

    for (i = 0; i < len; i += 3) {
        unsigned char b0 = data[i];
        unsigned char b1 = (i + 1 < len) ? data[i + 1] : 0;
        unsigned char b2 = (i + 2 < len) ? data[i + 2] : 0;

        output[j++] = b64url_table[b0 >> 2];
        output[j++] = b64url_table[((b0 & 0x03) << 4) | (b1 >> 4)];
        if (i + 1 < len) {
            output[j++] = b64url_table[((b1 & 0x0f) << 2) | (b2 >> 6)];
        }
        if (i + 2 < len) {
            output[j++] = b64url_table[b2 & 0x3f];
        }
    }
    output[j] = '\0';
}

// Base64URL decode character
int b64url_decode_char(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '-') return 62;
    if (c == '_') return 63;
    return -1;
}

// Base64URL decode
size_t base64url_decode(const char *input, unsigned char *output) {
    size_t len = strlen(input);
    size_t i, j = 0;

    for (i = 0; i < len; i += 4) {
        int b0 = b64url_decode_char(input[i]);
        int b1 = (i + 1 < len) ? b64url_decode_char(input[i + 1]) : 0;
        int b2 = (i + 2 < len) ? b64url_decode_char(input[i + 2]) : 0;
        int b3 = (i + 3 < len) ? b64url_decode_char(input[i + 3]) : 0;

        if (b0 < 0 || b1 < 0) break;

        output[j++] = (b0 << 2) | (b1 >> 4);

        if (i + 2 < len && b2 >= 0) {
            output[j++] = ((b1 & 0x0f) << 4) | (b2 >> 2);

            if (i + 3 < len && b3 >= 0) {
                output[j++] = ((b2 & 0x03) << 6) | b3;
            }
        }
    }

    output[j] = '\0';
    return j;
}

// Decode JWT
void decode_jwt(const char *token) {
    char *token_copy = strdup(token);
    char *header_b64 = strtok(token_copy, ".");
    char *payload_b64 = strtok(NULL, ".");
    char *signature_b64 = strtok(NULL, ".");

    if (!header_b64 || !payload_b64) {
        fprintf(stderr, "Error: Invalid JWT format\n");
        free(token_copy);
        return;
    }

    unsigned char header[4096];
    unsigned char payload[4096];

    base64url_decode(header_b64, header);
    base64url_decode(payload_b64, payload);

    printf("=== JWT Decoded ===\n\n");
    printf("Header:\n%s\n\n", header);
    printf("Payload:\n%s\n\n", payload);

    if (signature_b64) {
        printf("Signature: %s\n", signature_b64);
        printf("\nNote: Signature NOT verified. Use this for inspection only.\n");
    }

    free(token_copy);
}

// Encode JWT (unsigned - for testing only)
void encode_jwt(const char *payload) {
    // Default header for unsigned token
    const char *header = "{\"alg\":\"none\",\"typ\":\"JWT\"}";

    char header_b64[1024];
    char payload_b64[8192];

    base64url_encode((const unsigned char *)header, strlen(header), header_b64);
    base64url_encode((const unsigned char *)payload, strlen(payload), payload_b64);

    printf("%s.%s.\n", header_b64, payload_b64);
    printf("\nWarning: This is an unsigned JWT (alg: none). Do NOT use in production.\n");
}

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "Usage: jwt <encode|decode> <payload|token>\n");
        fprintf(stderr, "\nCommands:\n");
        fprintf(stderr, "  decode <token>    Decode and display JWT parts\n");
        fprintf(stderr, "  encode <payload>  Create unsigned JWT from JSON payload\n");
        fprintf(stderr, "\nNote: This tool does NOT verify signatures.\n");
        return 1;
    }

    const char *cmd = argv[1];
    const char *data = argv[2];

    if (strcmp(cmd, "decode") == 0) {
        decode_jwt(data);
    } else if (strcmp(cmd, "encode") == 0) {
        encode_jwt(data);
    } else {
        fprintf(stderr, "Error: Unknown command '%s'\n", cmd);
        return 1;
    }

    return 0;
}
