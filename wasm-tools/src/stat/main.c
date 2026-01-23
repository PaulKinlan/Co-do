/**
 * stat - Display file status information
 * Usage: stat <filename> [size] [mtime]
 * Since WASM has limited file access, this accepts metadata as arguments
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

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

void format_time(long long timestamp, char *buf, size_t buf_len) {
    time_t t = (time_t)timestamp;
    struct tm *tm_info = gmtime(&t);

    if (tm_info) {
        strftime(buf, buf_len, "%Y-%m-%d %H:%M:%S UTC", tm_info);
    } else {
        snprintf(buf, buf_len, "%lld", timestamp);
    }
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: stat <filename> [size] [mtime]\n");
        fprintf(stderr, "  size: file size in bytes\n");
        fprintf(stderr, "  mtime: modification time (Unix timestamp)\n");
        return 1;
    }

    const char *filename = argv[1];
    long long size = 0;
    long long mtime = 0;

    if (argc >= 3) {
        size = strtoll(argv[2], NULL, 10);
    }

    if (argc >= 4) {
        mtime = strtoll(argv[3], NULL, 10);
    }

    // Determine file type from name
    const char *type = "regular file";
    size_t name_len = strlen(filename);
    if (name_len > 0 && (filename[name_len - 1] == '/' || filename[name_len - 1] == '\\')) {
        type = "directory";
    }

    char size_str[64];
    char mtime_str[64];

    format_size(size, size_str, sizeof(size_str));
    format_time(mtime, mtime_str, sizeof(mtime_str));

    printf("  File: %s\n", filename);
    printf("  Size: %lld bytes (%s)\n", size, size_str);
    printf("  Type: %s\n", type);

    if (mtime > 0) {
        printf("Modify: %s\n", mtime_str);
    }

    // Detect extension
    const char *ext = strrchr(filename, '.');
    if (ext) {
        printf("   Ext: %s\n", ext + 1);
    }

    return 0;
}
