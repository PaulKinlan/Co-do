/**
 * file - Detect file type based on magic bytes
 * Usage: file <filename-or-hex-content>
 */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <ctype.h>

typedef struct {
    const char *magic_hex;
    int offset;
    const char *description;
} MagicEntry;

static const MagicEntry magic_table[] = {
    // Images
    {"89504e47", 0, "PNG image"},
    {"ffd8ff", 0, "JPEG image"},
    {"47494638", 0, "GIF image"},
    {"424d", 0, "BMP image"},
    {"52494646", 0, "WEBP image"},  // RIFF header
    {"49492a00", 0, "TIFF image (little-endian)"},
    {"4d4d002a", 0, "TIFF image (big-endian)"},

    // Archives
    {"504b0304", 0, "ZIP archive"},
    {"504b0506", 0, "ZIP archive (empty)"},
    {"1f8b08", 0, "gzip compressed data"},
    {"425a68", 0, "bzip2 compressed data"},
    {"fd377a58", 0, "xz compressed data"},
    {"28b52ffd", 0, "zstd compressed data"},
    {"526172211a07", 0, "RAR archive"},
    {"377abcaf271c", 0, "7-zip archive"},

    // Documents
    {"25504446", 0, "PDF document"},
    {"d0cf11e0", 0, "Microsoft Office document"},

    // Executables
    {"7f454c46", 0, "ELF executable"},
    {"4d5a", 0, "DOS/Windows executable"},
    {"cafebabe", 0, "Java class file"},
    {"feedface", 0, "Mach-O executable (32-bit)"},
    {"feedfacf", 0, "Mach-O executable (64-bit)"},
    {"cffaedfe", 0, "Mach-O executable (64-bit, reversed)"},
    {"0061736d", 0, "WebAssembly module"},

    // Audio/Video
    {"494433", 0, "MP3 audio (ID3 tag)"},
    {"fffb", 0, "MP3 audio"},
    {"fff3", 0, "MP3 audio"},
    {"4f676753", 0, "Ogg container"},
    {"664c6143", 0, "FLAC audio"},
    {"52494646", 0, "RIFF (WAV/AVI)"},
    {"1a45dfa3", 0, "WebM/Matroska video"},
    {"000000", 0, "MP4/MOV video"},  // Needs further checking

    // Web
    {"3c21444f4354595045", 0, "HTML document"},
    {"3c68746d6c", 0, "HTML document"},
    {"3c3f786d6c", 0, "XML document"},
    {"7b", 0, "JSON data"},

    // Code/Text
    {"23212f", 0, "Script (shebang)"},
    {"efbbbf", 0, "UTF-8 text (with BOM)"},
    {"fffe", 0, "UTF-16 text (LE BOM)"},
    {"feff", 0, "UTF-16 text (BE BOM)"},

    {NULL, 0, NULL}
};

// Convert hex string to bytes
int hex_to_bytes(const char *hex, uint8_t *out, size_t max_len) {
    size_t hex_len = strlen(hex);
    size_t byte_len = hex_len / 2;
    if (byte_len > max_len) byte_len = max_len;

    for (size_t i = 0; i < byte_len; i++) {
        unsigned int byte;
        if (sscanf(hex + i * 2, "%2x", &byte) != 1) {
            return i;
        }
        out[i] = (uint8_t)byte;
    }
    return byte_len;
}

// Convert bytes to hex for comparison
void bytes_to_hex(const uint8_t *bytes, size_t len, char *out) {
    for (size_t i = 0; i < len; i++) {
        sprintf(out + i * 2, "%02x", bytes[i]);
    }
    out[len * 2] = '\0';
}

// Check if input is all hex characters
int is_hex_string(const char *s) {
    for (; *s; s++) {
        if (!isxdigit((unsigned char)*s)) return 0;
    }
    return 1;
}

const char* detect_type(const uint8_t *data, size_t len) {
    char hex_buf[64];
    size_t check_len = len > 16 ? 16 : len;
    bytes_to_hex(data, check_len, hex_buf);

    // Convert to lowercase for comparison
    for (char *p = hex_buf; *p; p++) {
        *p = tolower((unsigned char)*p);
    }

    for (const MagicEntry *entry = magic_table; entry->magic_hex; entry++) {
        size_t magic_len = strlen(entry->magic_hex);
        if (strncmp(hex_buf + entry->offset * 2, entry->magic_hex, magic_len) == 0) {
            return entry->description;
        }
    }

    // Check if it looks like text
    int printable = 1;
    for (size_t i = 0; i < len && i < 100; i++) {
        if (data[i] < 32 && data[i] != '\n' && data[i] != '\r' && data[i] != '\t') {
            printable = 0;
            break;
        }
    }

    if (printable) {
        return "ASCII text";
    }

    return "data";
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: file <filename-or-hex-content>\n");
        return 1;
    }

    const char *input = argv[1];
    uint8_t buffer[1024];
    size_t len;

    // If input looks like hex data, decode it
    if (strlen(input) >= 4 && is_hex_string(input)) {
        len = hex_to_bytes(input, buffer, sizeof(buffer));
    } else {
        // Treat as raw content (just take first bytes)
        len = strlen(input);
        if (len > sizeof(buffer)) len = sizeof(buffer);
        memcpy(buffer, input, len);
    }

    const char *type = detect_type(buffer, len);
    printf("%s\n", type);

    return 0;
}
