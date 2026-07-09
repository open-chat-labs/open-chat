const INLINE_WRAPPERS = new Set(["SPAN", "STRONG", "B", "EM", "I", "U"]);

// When text is copied from a rendered message, mentions arrive in the clipboard
// HTML as <profile-link> elements or styled anchors (?everyone / ?usergroup=N).
// Convert them back to mention nodes / plain text before tiptap parses the
// paste, otherwise they end up being sent as literal markdown markup like
// <u>[@everyone](https://oc.app/...?everyone)</u>.
export function transformPastedHTML(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");

    for (const el of [...doc.querySelectorAll("profile-link")]) {
        const userId = el.getAttribute("user-id");
        const username = el.getAttribute("text");
        if (!userId || !username) continue;
        const span = doc.createElement("span");
        span.setAttribute("data-type", "user_mention");
        span.setAttribute("userId", userId);
        span.setAttribute("username", username);
        span.textContent = `@${username}`;
        replaceUnwrapped(el, span);
    }

    for (const a of [...doc.querySelectorAll("a")]) {
        const text = a.textContent ?? "";
        let url: URL;
        try {
            url = new URL(a.getAttribute("href") ?? "", window.location.href);
        } catch {
            continue;
        }
        if (
            url.origin !== window.location.origin &&
            url.hostname !== "oc.app" &&
            !url.hostname.endsWith(".oc.app")
        ) {
            continue;
        }
        if (url.searchParams.has("everyone") && text === "@everyone") {
            replaceUnwrapped(a, doc.createTextNode("@everyone"));
        } else {
            const groupId = url.searchParams.get("usergroup");
            if (groupId && /^\d+$/.test(groupId) && text.startsWith("@")) {
                const span = doc.createElement("span");
                span.setAttribute("data-type", "group_mention");
                span.setAttribute("groupId", groupId);
                span.setAttribute("groupname", text.slice(1));
                span.textContent = text;
                replaceUnwrapped(a, span);
            }
        }
    }

    return doc.body.innerHTML;
}

// Replace `el` with `replacement`, also dropping any inline wrappers (bold,
// underline, style spans) that contain nothing but `el`, so the mention
// doesn't pick up formatting marks from the copied message's styling.
function replaceUnwrapped(el: Element, replacement: Node) {
    let target: Element = el;
    while (
        target.parentElement &&
        INLINE_WRAPPERS.has(target.parentElement.tagName) &&
        target.parentElement.textContent === el.textContent
    ) {
        target = target.parentElement;
    }
    target.replaceWith(replacement);
}
