import type { MessagePreview } from "openchat-shared";

// Originally taken from here - https://stackoverflow.com/a/6041965
const URL_REGEX = new RegExp(
    `(https?):\\/\\/(localhost|[\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:\\/~+#-]*[\\w@?^=%&\\/~+#-])`,
    "g",
);

const communityMessageRegex = /\/community\/([a-z0-9_-]+)\/channel\/(\d+)\/(\d+)(?:\/(\d+))?/i;
const groupMessageRegex = /\/group\/([a-z0-9_-]+)\/(\d+)(?:\/(\d+))?/i;

function extractUrls(text: string): string[] {
    const withoutMarkdownDisplayText = text.replace(/\[[^\]]*\]\((https?:\/\/[^)]*)\)/g, "$1");
    const urls = withoutMarkdownDisplayText.match(URL_REGEX) ?? [];
    return [...new Set(urls.filter((u) => !u.endsWith("#LINK_REMOVED")))];
}

function parseOCMessageUrl(urlText: string): MessagePreview | undefined {
    let url: URL;
    try {
        url = new URL(urlText);
    } catch {
        return;
    }
    if (
        url.hostname !== "oc.app" &&
        !url.hostname.endsWith(".oc.app") &&
        url.hostname !== "localhost"
    ) {
        return;
    }

    let m = url.pathname.match(communityMessageRegex);
    if (m) {
        return {
            kind: "message",
            url: urlText,
            chatId: {
                kind: "channel",
                communityId: m[1],
                channelId: Number(m[2]),
            },
            threadRootMessageIndex: m[4] ? Number(m[3]) : undefined,
            messageIndex: m[4] ? Number(m[4]) : Number(m[3]),
        };
    }

    m = url.pathname.match(groupMessageRegex);
    if (m) {
        return {
            kind: "message",
            url: urlText,
            chatId: {
                kind: "group_chat",
                groupId: m[1],
            },
            threadRootMessageIndex: m[3] ? Number(m[2]) : undefined,
            messageIndex: m[3] ? Number(m[3]) : Number(m[2]),
        };
    }
}

export function extractMessagePreviews(text: string): MessagePreview[] {
    return extractUrls(text).reduce<MessagePreview[]>((previews, url) => {
        const preview = parseOCMessageUrl(url);
        if (preview) previews.push(preview);
        return previews;
    }, []);
}
