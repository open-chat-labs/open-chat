<svelte:options immutable={true} />

<script lang="ts">
    import { marked } from "marked";
    import DOMPurify from "dompurify";
    import { afterUpdate } from "svelte";
    import { rollbar } from "../../utils/logging";
    import { userStore } from "../../stores/user";
    import { _ } from "svelte-i18n";
    import { isAbsoluteUrl, synonymousUrlRegex } from "../../utils/urls";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;

    let sanitized = "unsafe";
    const options = {
        breaks: !oneLine,
    };

    type MentionToken = {
        type: "mention";
        raw: string;
        username: string;
        userId: string;
    };

    const mention = {
        name: "mention",
        level: "inline" as "inline",
        start: (src: string) => {
            return src.match(/@/)?.index ?? -1;
        },
        tokenizer: (src: string) => {
            const rule = /^@UserId\(([\d\w-]+)\)/;
            const match = rule.exec(src);
            if (match) {
                const username = $userStore[match[1]]?.username ?? $_("unknown");
                return {
                    type: "mention",
                    raw: match[0],
                    username,
                    userId: match[1],
                };
            }
        },
        renderer: (token: MentionToken) => {
            return `<a href="#/${token.userId}?type=direct"><strong>@${token.username}</strong></a>`;
        },
        childTokens: ["strong"],
    };

    const renderer = {
        link(href: string | null, title: string | null, text: string) {
            if (suppressLinks || href === null) {
                return `<span class="fake-link" ${title && `title=${title}`}>${text}</span>`;
            } else {
                let target = "";
                // Check if the link is to a synonymous url (eg. https://oc.app), if so, convert it to a relative link
                if (synonymousUrlRegex.test(href)) {
                    href = href.replace(synonymousUrlRegex, "");
                    if (href === "" || href === "/") {
                        href = "/#";
                    }
                } else if (isAbsoluteUrl(href)) {
                    target = 'target="_blank"';
                }

                return `<a href=${href} ${title && `title=${title}`} ${target}>${text}</a>`;
            }
        },
    };

    marked.use({ renderer, extensions: [mention] });

    function render() {
        let parsed = text;
        try {
            console.log("Rendering markdown: ", oneLine, suppressLinks, text)
            parsed = marked.parseInline(text, options);
        } catch (err: any) {
            rollbar.error("Error parsing markdown: ", err);
        }

        try {
            sanitized = DOMPurify.sanitize(parsed, {
                ALLOWED_ATTR: ["target", "href", "class"],
            });
        } catch (err: any) {
            rollbar.error("Error sanitzing message content: ", err);
        }
    }

    afterUpdate(render);
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    {@html sanitized}
</p>

<style type="text/scss">
    :global(.markdown-wrapper a) {
        text-decoration: underline;
    }

    :global(.markdown-wrapper .fake-link) {
        text-decoration: underline;
    }

    :global(.markdown-wrapper code) {
        border: 1px solid rgba(0, 0, 0, 0.1);
        background-color: rgba(255, 255, 255, 0.1);
        padding: 0 $sp2;
    }

    .markdown-wrapper {
        word-wrap: break-word;
    }

    .markdown-wrapper:not(:empty) {
        display: inline;

        &:not(.inline) {
            display: block;
        }

        &.oneLine {
            display: block;
            @include ellipsis();
        }
    }
</style>
