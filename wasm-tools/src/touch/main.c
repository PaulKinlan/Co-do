/**
 * touch - Update file timestamps (output command for external execution)
 * Usage: touch [-a] [-m] [-t timestamp] <filename>
 * Note: WASM cannot modify filesystem directly, outputs the action to perform
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

int main(int argc, char **argv) {
    int access_time = 0;
    int modify_time = 0;
    const char *timestamp = NULL;
    const char *filename = NULL;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-a") == 0) {
            access_time = 1;
        } else if (strcmp(argv[i], "-m") == 0) {
            modify_time = 1;
        } else if (strcmp(argv[i], "-t") == 0 && i + 1 < argc) {
            timestamp = argv[++i];
        } else if (argv[i][0] != '-') {
            filename = argv[i];
        }
    }

    if (!filename) {
        fprintf(stderr, "Usage: touch [-a] [-m] [-t timestamp] <filename>\n");
        fprintf(stderr, "Options:\n");
        fprintf(stderr, "  -a  Change access time only\n");
        fprintf(stderr, "  -m  Change modification time only\n");
        fprintf(stderr, "  -t  Specify timestamp (Unix epoch or ISO 8601)\n");
        return 1;
    }

    // Default: update both times
    if (!access_time && !modify_time) {
        access_time = 1;
        modify_time = 1;
    }

    // Parse timestamp
    time_t ts;
    if (timestamp) {
        // Try parsing as Unix timestamp
        char *endptr;
        ts = (time_t)strtoll(timestamp, &endptr, 10);
        if (*endptr != '\0') {
            // Not a Unix timestamp, try ISO 8601
            struct tm tm = {0};
            if (sscanf(timestamp, "%d-%d-%d %d:%d:%d",
                       &tm.tm_year, &tm.tm_mon, &tm.tm_mday,
                       &tm.tm_hour, &tm.tm_min, &tm.tm_sec) >= 3) {
                tm.tm_year -= 1900;
                tm.tm_mon -= 1;
                ts = mktime(&tm);
            } else {
                fprintf(stderr, "Error: Invalid timestamp format\n");
                return 1;
            }
        }
    } else {
        ts = time(NULL);
    }

    // Output action description
    printf("Touch: %s\n", filename);
    printf("Timestamp: %lld\n", (long long)ts);

    char time_str[64];
    struct tm *tm_info = gmtime(&ts);
    if (tm_info) {
        strftime(time_str, sizeof(time_str), "%Y-%m-%d %H:%M:%S UTC", tm_info);
        printf("DateTime: %s\n", time_str);
    }

    printf("UpdateAccess: %s\n", access_time ? "yes" : "no");
    printf("UpdateModify: %s\n", modify_time ? "yes" : "no");

    return 0;
}
