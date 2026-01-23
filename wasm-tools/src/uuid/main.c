/**
 * uuid - Generate UUID v4
 * Usage: uuid [-n COUNT]
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <time.h>

// Simple PRNG (xorshift64)
static uint64_t rng_state;

void seed_rng(void) {
    // Use time as seed - in WASI this should work
    rng_state = (uint64_t)time(NULL) ^ 0x5DEECE66DULL;
    if (rng_state == 0) rng_state = 1;
}

uint64_t next_random(void) {
    uint64_t x = rng_state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    rng_state = x;
    return x;
}

void generate_uuid(char *buf) {
    uint8_t bytes[16];

    // Generate random bytes
    uint64_t r1 = next_random();
    uint64_t r2 = next_random();
    memcpy(bytes, &r1, 8);
    memcpy(bytes + 8, &r2, 8);

    // Set version (4) and variant (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;  // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;  // Variant 1

    // Format as UUID string
    sprintf(buf,
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
}

int main(int argc, char **argv) {
    int count = 1;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) {
            count = atoi(argv[++i]);
        }
    }

    if (count < 1) count = 1;
    if (count > 1000) count = 1000;

    seed_rng();

    char uuid[37];
    for (int i = 0; i < count; i++) {
        generate_uuid(uuid);
        printf("%s\n", uuid);
    }

    return 0;
}
