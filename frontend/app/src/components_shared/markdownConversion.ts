/* eslint-disable @typescript-eslint/no-explicit-any */

export function nodeToMarkdown(node: any): string {
    if (node.type === "text") {
        let t: string = node.text ?? "";
        for (const mark of node.marks ?? []) {
            switch (mark.type) {
                case "bold":
                    t = `**${t}**`;
                    break;
                case "italic":
                    t = `*${t}*`;
                    break;
                case "strike":
                    t = `~~${t}~~`;
                    break;
                case "code":
                    t = `\`${t}\``;
                    break;
                case "underline":
                    t = `<u>${t}</u>`;
                    break;
                case "link":
                    t = `[${t}](${mark.attrs?.href ?? ""})`;
                    break;
            }
        }
        return t;
    }

    const children: string[] = (node.content ?? []).map(nodeToMarkdown);

    switch (node.type) {
        case "doc":
            return children.join("\n\n").trim();
        case "paragraph":
            return children.join("");
        case "hardBreak":
            return "\n";
        case "heading":
            return "#".repeat(node.attrs?.level ?? 1) + " " + children.join("");
        case "blockquote":
            return children
                .join("\n>\n")
                .split("\n")
                .map((l: string) => `> ${l}`)
                .join("\n");
        case "codeBlock": {
            const lang: string = node.attrs?.language ?? "";
            const code = (node.content ?? []).map((n: any) => n.text ?? "").join("");
            return `\`\`\`${lang}\n${code}\n\`\`\``;
        }
        case "bulletList":
            return (node.content ?? []).map((item: any) => `- ${nodeToMarkdown(item)}`).join("\n");
        case "orderedList":
            return (node.content ?? [])
                .map((item: any, i: number) => `${i + 1}. ${nodeToMarkdown(item)}`)
                .join("\n");
        case "user_mention":
            return `@UserId(${node.attrs.userId})`;
        case "group_mention":
            return `@UserGroup(${node.attrs.groupId})`;
        case "horizontalRule":
            return "---";
        default:
            return children.join("\n");
    }
}

export function parseInline(text: string): any[] {
    const nodes: any[] = [];
    let pos = 0;
    let textStart = 0;

    function flush(end: number) {
        if (end > textStart) nodes.push({ type: "text", text: text.slice(textStart, end) });
    }

    while (pos < text.length) {
        // mention: @UserId(123)
        if (text[pos] === "@") {
            const m = /^@UserId\((\d+)\)/.exec(text.slice(pos));
            if (m) {
                flush(pos);
                nodes.push({
                    type: "user_mention",
                    attrs: { userId: m[1], username: `UserId(${m[1]})` },
                });
                pos += m[0].length;
                textStart = pos;
                continue;
            }
            const g = /^@UserGroup\((\d+)\)/.exec(text.slice(pos));
            if (g) {
                flush(pos);
                nodes.push({
                    type: "group_mention",
                    attrs: { groupId: g[1], groupname: `UserGroup(${g[1]})` },
                });
                pos += g[0].length;
                textStart = pos;
                continue;
            }
        }
        // bold+italic: ***text***
        if (text.startsWith("***", pos)) {
            const end = text.indexOf("***", pos + 3);
            if (end !== -1) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: text.slice(pos + 3, end),
                    marks: [{ type: "bold" }, { type: "italic" }],
                });
                pos = end + 3;
                textStart = pos;
                continue;
            }
        }
        // bold: **text**
        if (text.startsWith("**", pos)) {
            const end = text.indexOf("**", pos + 2);
            if (end !== -1) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: text.slice(pos + 2, end),
                    marks: [{ type: "bold" }],
                });
                pos = end + 2;
                textStart = pos;
                continue;
            }
        }
        // strikethrough: ~~text~~
        if (text.startsWith("~~", pos)) {
            const end = text.indexOf("~~", pos + 2);
            if (end !== -1) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: text.slice(pos + 2, end),
                    marks: [{ type: "strike" }],
                });
                pos = end + 2;
                textStart = pos;
                continue;
            }
        }
        // italic: *text*
        if (text[pos] === "*" && text[pos + 1] !== "*") {
            const end = text.indexOf("*", pos + 1);
            if (end !== -1) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: text.slice(pos + 1, end),
                    marks: [{ type: "italic" }],
                });
                pos = end + 1;
                textStart = pos;
                continue;
            }
        }
        // inline code: `text`
        if (text[pos] === "`") {
            const end = text.indexOf("`", pos + 1);
            if (end !== -1) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: text.slice(pos + 1, end),
                    marks: [{ type: "code" }],
                });
                pos = end + 1;
                textStart = pos;
                continue;
            }
        }
        // underline: <u>text</u>
        if (text.startsWith("<u>", pos)) {
            const end = text.indexOf("</u>", pos + 3);
            if (end !== -1) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: text.slice(pos + 3, end),
                    marks: [{ type: "underline" }],
                });
                pos = end + 4;
                textStart = pos;
                continue;
            }
        }
        // link: [text](url)
        if (text[pos] === "[") {
            const m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(text.slice(pos));
            if (m) {
                flush(pos);
                nodes.push({
                    type: "text",
                    text: m[1],
                    marks: [{ type: "link", attrs: { href: m[2] } }],
                });
                pos += m[0].length;
                textStart = pos;
                continue;
            }
        }
        pos++;
    }
    flush(text.length);
    return nodes;
}

export function blockToNode(block: string): any | null {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Code block: ```lang\ncode\n```
    const codeMatch = /^```(\w*)\n([\s\S]*)\n```$/.exec(trimmed);
    if (codeMatch) {
        return {
            type: "codeBlock",
            attrs: { language: codeMatch[1] || null },
            content: [{ type: "text", text: codeMatch[2] }],
        };
    }
    // Heading: # text
    const headingMatch = /^(#{1,6}) (.+)$/.exec(trimmed);
    if (headingMatch) {
        return {
            type: "heading",
            attrs: { level: headingMatch[1].length },
            content: parseInline(headingMatch[2]),
        };
    }
    // Horizontal rule
    if (trimmed === "---") return { type: "horizontalRule" };
    // Blockquote: all lines start with "> "
    const bqLines = trimmed.split("\n");
    if (bqLines.every((l) => l.startsWith("> "))) {
        const inner = bqLines.map((l) => l.slice(2)).join("\n\n");
        return { type: "blockquote", content: markdownToDoc(inner).content };
    }
    // Bullet list: all non-empty lines start with "- "
    const listLines = trimmed.split("\n").filter(Boolean);
    if (listLines.length > 0 && listLines.every((l) => l.startsWith("- "))) {
        return {
            type: "bulletList",
            content: listLines.map((l) => ({
                type: "listItem",
                content: [{ type: "paragraph", content: parseInline(l.slice(2)) }],
            })),
        };
    }
    // Ordered list: all non-empty lines start with "N. "
    if (listLines.length > 0 && listLines.every((l) => /^\d+\. /.test(l))) {
        return {
            type: "orderedList",
            content: listLines.map((l) => ({
                type: "listItem",
                content: [{ type: "paragraph", content: parseInline(l.replace(/^\d+\. /, "")) }],
            })),
        };
    }
    // Paragraph with hardBreaks for \n within the block
    const inlineContent: any[] = [];
    const lines = trimmed.split("\n");
    lines.forEach((line, i) => {
        inlineContent.push(...parseInline(line));
        if (i < lines.length - 1) inlineContent.push({ type: "hardBreak" });
    });
    return { type: "paragraph", content: inlineContent };
}

export function markdownToDoc(markdown: string): any {
    if (!markdown.trim()) return { type: "doc", content: [{ type: "paragraph" }] };
    // Split by double newlines, but re-merge code blocks that contain blank lines
    const rawBlocks = markdown.trim().split(/\n\n+/);
    const blocks: string[] = [];
    let codeAccum: string | null = null;
    for (const block of rawBlocks) {
        if (codeAccum !== null) {
            codeAccum += "\n\n" + block;
            if (/^```\s*$/.test(block.trimEnd())) {
                blocks.push(codeAccum);
                codeAccum = null;
            }
        } else if (block.startsWith("```") && !block.trimEnd().endsWith("```")) {
            codeAccum = block;
        } else {
            blocks.push(block);
        }
    }
    if (codeAccum !== null) blocks.push(codeAccum);
    const content = blocks.map(blockToNode).filter(Boolean);
    return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
