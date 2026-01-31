/**
 * sha256sum - Calculate SHA-256 hash
 * Usage: sha256sum <text>
 *
 * Implementation based on FIPS 180-4
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "../stdin_read.h"

// SHA-256 constants
static const uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

#define ROTR(x, n) (((x) >> (n)) | ((x) << (32 - (n))))
#define CH(x, y, z) (((x) & (y)) ^ (~(x) & (z)))
#define MAJ(x, y, z) (((x) & (y)) ^ ((x) & (z)) ^ ((y) & (z)))
#define SIG0(x) (ROTR(x, 2) ^ ROTR(x, 13) ^ ROTR(x, 22))
#define SIG1(x) (ROTR(x, 6) ^ ROTR(x, 11) ^ ROTR(x, 25))
#define sig0(x) (ROTR(x, 7) ^ ROTR(x, 18) ^ ((x) >> 3))
#define sig1(x) (ROTR(x, 17) ^ ROTR(x, 19) ^ ((x) >> 10))

void sha256(const uint8_t *data, size_t len, uint8_t *hash) {
    uint32_t H[8] = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };

    // Padding
    size_t padded_len = ((len + 8) / 64 + 1) * 64;
    uint8_t *padded = (uint8_t *)calloc(padded_len, 1);
    memcpy(padded, data, len);
    padded[len] = 0x80;

    // Length in bits (big-endian)
    uint64_t bit_len = len * 8;
    for (int i = 0; i < 8; i++) {
        padded[padded_len - 1 - i] = (bit_len >> (i * 8)) & 0xff;
    }

    // Process blocks
    for (size_t offset = 0; offset < padded_len; offset += 64) {
        uint32_t W[64];

        // Prepare message schedule
        for (int i = 0; i < 16; i++) {
            W[i] = ((uint32_t)padded[offset + i*4] << 24) |
                   ((uint32_t)padded[offset + i*4 + 1] << 16) |
                   ((uint32_t)padded[offset + i*4 + 2] << 8) |
                   ((uint32_t)padded[offset + i*4 + 3]);
        }
        for (int i = 16; i < 64; i++) {
            W[i] = sig1(W[i-2]) + W[i-7] + sig0(W[i-15]) + W[i-16];
        }

        // Working variables
        uint32_t a = H[0], b = H[1], c = H[2], d = H[3];
        uint32_t e = H[4], f = H[5], g = H[6], h = H[7];

        // Compression
        for (int i = 0; i < 64; i++) {
            uint32_t T1 = h + SIG1(e) + CH(e, f, g) + K[i] + W[i];
            uint32_t T2 = SIG0(a) + MAJ(a, b, c);
            h = g; g = f; f = e; e = d + T1;
            d = c; c = b; b = a; a = T1 + T2;
        }

        H[0] += a; H[1] += b; H[2] += c; H[3] += d;
        H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }

    free(padded);

    // Output hash
    for (int i = 0; i < 8; i++) {
        hash[i*4] = (H[i] >> 24) & 0xff;
        hash[i*4 + 1] = (H[i] >> 16) & 0xff;
        hash[i*4 + 2] = (H[i] >> 8) & 0xff;
        hash[i*4 + 3] = H[i] & 0xff;
    }
}

int main(int argc, char **argv) {
    const char *input = (argc >= 2) ? argv[1] : NULL;
    char *stdin_buf = NULL;
    if (!input) {
        stdin_buf = read_all_stdin();
        if (!stdin_buf) {
            fprintf(stderr, "Usage: sha256sum <text>\nOr pipe input via stdin.\n");
            return 1;
        }
        input = stdin_buf;
    }

    uint8_t hash[32];

    sha256((const uint8_t *)input, strlen(input), hash);

    for (int i = 0; i < 32; i++) {
        printf("%02x", hash[i]);
    }
    printf("\n");

    free(stdin_buf);
    return 0;
}
