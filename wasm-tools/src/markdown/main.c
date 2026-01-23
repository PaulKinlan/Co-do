/**
 * markdown - Convert Markdown to HTML
 * Usage: markdown <markdown-text>
 * Note: Simplified Markdown parser supporting common elements
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// HTML escape
void print_escaped(const char *text) {
    for (const char *p = text; *p; p++) {
        switch (*p) {
            case '<': printf("&lt;"); break;
            case '>': printf("&gt;"); break;
            case '&': printf("&amp;"); break;
            case '"': printf("&quot;"); break;
            default: putchar(*p);
        }
    }
}

// Process inline formatting
void process_inline(const char *text) {
    const char *p = text;

    while (*p) {
        // Bold: **text** or __text__
        if ((*p == '*' && *(p+1) == '*') || (*p == '_' && *(p+1) == '_')) {
            char marker = *p;
            const char *start = p + 2;
            const char *end = strstr(start, (*p == '*') ? "**" : "__");
            if (end) {
                printf("<strong>");
                for (const char *c = start; c < end; c++) {
                    if (*c == '<') printf("&lt;");
                    else if (*c == '>') printf("&gt;");
                    else if (*c == '&') printf("&amp;");
                    else putchar(*c);
                }
                printf("</strong>");
                p = end + 2;
                continue;
            }
        }

        // Italic: *text* or _text_
        if (*p == '*' || *p == '_') {
            char marker = *p;
            const char *start = p + 1;
            const char *end = strchr(start, marker);
            if (end && end > start) {
                printf("<em>");
                for (const char *c = start; c < end; c++) {
                    if (*c == '<') printf("&lt;");
                    else if (*c == '>') printf("&gt;");
                    else if (*c == '&') printf("&amp;");
                    else putchar(*c);
                }
                printf("</em>");
                p = end + 1;
                continue;
            }
        }

        // Code: `text`
        if (*p == '`') {
            const char *start = p + 1;
            const char *end = strchr(start, '`');
            if (end) {
                printf("<code>");
                print_escaped(start);
                // Manually stop at end
                for (const char *c = start; c < end; c++) {
                    if (*c == '<') printf("&lt;");
                    else if (*c == '>') printf("&gt;");
                    else if (*c == '&') printf("&amp;");
                    else putchar(*c);
                }
                printf("</code>");
                p = end + 1;
                continue;
            }
        }

        // Link: [text](url)
        if (*p == '[') {
            const char *text_start = p + 1;
            const char *text_end = strchr(text_start, ']');
            if (text_end && *(text_end + 1) == '(') {
                const char *url_start = text_end + 2;
                const char *url_end = strchr(url_start, ')');
                if (url_end) {
                    printf("<a href=\"");
                    for (const char *c = url_start; c < url_end; c++) {
                        putchar(*c);
                    }
                    printf("\">");
                    for (const char *c = text_start; c < text_end; c++) {
                        if (*c == '<') printf("&lt;");
                        else if (*c == '>') printf("&gt;");
                        else if (*c == '&') printf("&amp;");
                        else putchar(*c);
                    }
                    printf("</a>");
                    p = url_end + 1;
                    continue;
                }
            }
        }

        // Regular character
        if (*p == '<') printf("&lt;");
        else if (*p == '>') printf("&gt;");
        else if (*p == '&') printf("&amp;");
        else putchar(*p);
        p++;
    }
}

// Process a single line
void process_line(const char *line, int *in_code_block, int *in_list) {
    // Skip leading whitespace for analysis
    const char *trimmed = line;
    while (*trimmed == ' ' || *trimmed == '\t') trimmed++;

    // Code block
    if (strncmp(trimmed, "```", 3) == 0) {
        if (*in_code_block) {
            printf("</code></pre>\n");
            *in_code_block = 0;
        } else {
            printf("<pre><code>");
            *in_code_block = 1;
        }
        return;
    }

    if (*in_code_block) {
        print_escaped(line);
        putchar('\n');
        return;
    }

    // Empty line
    if (*trimmed == '\0') {
        if (*in_list) {
            printf("</ul>\n");
            *in_list = 0;
        }
        printf("\n");
        return;
    }

    // Headers
    if (*trimmed == '#') {
        int level = 0;
        const char *p = trimmed;
        while (*p == '#' && level < 6) { level++; p++; }
        if (*p == ' ') {
            p++;
            printf("<h%d>", level);
            process_inline(p);
            printf("</h%d>\n", level);
            return;
        }
    }

    // Horizontal rule
    if ((strncmp(trimmed, "---", 3) == 0 || strncmp(trimmed, "***", 3) == 0 ||
         strncmp(trimmed, "___", 3) == 0)) {
        printf("<hr>\n");
        return;
    }

    // Unordered list
    if ((*trimmed == '-' || *trimmed == '*' || *trimmed == '+') && *(trimmed + 1) == ' ') {
        if (!*in_list) {
            printf("<ul>\n");
            *in_list = 1;
        }
        printf("<li>");
        process_inline(trimmed + 2);
        printf("</li>\n");
        return;
    }

    // Ordered list
    if (isdigit((unsigned char)*trimmed)) {
        const char *p = trimmed;
        while (isdigit((unsigned char)*p)) p++;
        if (*p == '.' && *(p + 1) == ' ') {
            if (!*in_list) {
                printf("<ol>\n");
                *in_list = 2;
            }
            printf("<li>");
            process_inline(p + 2);
            printf("</li>\n");
            return;
        }
    }

    // Blockquote
    if (*trimmed == '>') {
        const char *content = trimmed + 1;
        if (*content == ' ') content++;
        printf("<blockquote>");
        process_inline(content);
        printf("</blockquote>\n");
        return;
    }

    // Close list if open
    if (*in_list) {
        printf(*in_list == 1 ? "</ul>\n" : "</ol>\n");
        *in_list = 0;
    }

    // Regular paragraph
    printf("<p>");
    process_inline(trimmed);
    printf("</p>\n");
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: markdown <markdown-text>\n");
        return 1;
    }

    char *input = strdup(argv[1]);
    char *line = strtok(input, "\n");
    int in_code_block = 0;
    int in_list = 0;

    while (line) {
        process_line(line, &in_code_block, &in_list);
        line = strtok(NULL, "\n");
    }

    // Close any open blocks
    if (in_code_block) {
        printf("</code></pre>\n");
    }
    if (in_list) {
        printf(in_list == 1 ? "</ul>\n" : "</ol>\n");
    }

    free(input);
    return 0;
}
