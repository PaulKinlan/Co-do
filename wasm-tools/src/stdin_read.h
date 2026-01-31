/**
 * Common stdin reading utility for WASM tools.
 *
 * Provides read_all_stdin() which reads all of stdin into a
 * dynamically allocated null-terminated buffer. Returns NULL
 * if stdin is empty or allocation fails.
 *
 * Usage in a tool's main():
 *   if (!input) {
 *       input = read_all_stdin();
 *       if (!input) { fprintf(stderr, "Usage: ..."); return 1; }
 *       stdin_used = 1;
 *   }
 *   // ... process input ...
 *   if (stdin_used) free((void *)input);
 */

#ifndef STDIN_READ_H
#define STDIN_READ_H

#include <stdio.h>
#include <stdlib.h>

static char *read_all_stdin(void) {
    size_t cap = 4096, len = 0;
    char *buf = (char *)malloc(cap);
    if (!buf) return NULL;

    while (1) {
        size_t n = fread(buf + len, 1, cap - len, stdin);
        len += n;
        if (n < cap - len) break; /* EOF or error */
        cap *= 2;
        char *tmp = (char *)realloc(buf, cap);
        if (!tmp) { free(buf); return NULL; }
        buf = tmp;
    }

    if (len == 0) { free(buf); return NULL; }

    /* Null-terminate */
    char *tmp = (char *)realloc(buf, len + 1);
    if (tmp) buf = tmp;
    buf[len] = '\0';

    return buf;
}

#endif /* STDIN_READ_H */
