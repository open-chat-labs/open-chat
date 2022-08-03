<svelte:options immutable={true} />

<script lang="ts">
    import { userStore } from "../../stores/user";
    import { _ } from "svelte-i18n";
    import { marked } from "marked";
    import DOMPurify from "dompurify";
    import { rollbar } from "../../utils/logging";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;
    export let isInline: boolean = true;

    let sanitized = "unsafe";
    $: options = {
        breaks: !oneLine,
    };

    function replaceUserIds(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $userStore[p1];
            if (u !== undefined) {
                return `**[@${u.username}](#/${u.userId}?type=direct)**`;
            }
            return match;
        });
    }

    $: {
        let parsed = replaceUserIds(text);
        try {
            if (isInline) {
                parsed = marked.parseInline(parsed, options);
            } else {
                parsed = marked.parse(parsed, options);
            }
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
</script>

<p class="markdown-wrapper" class:inline class:oneLine class:suppressLinks>
    {@html sanitized}
</p>

<style type="text/scss">
    :global {
        .markdown-wrapper {
            h1 {
                @include font-size(fs-140);
            }

            h2 {
                @include font-size(fs-120);
            }

            h3 {
                @include font-size(fs-110);
            }

            h1,
            h2,
            h3,
            h4 {
                font-weight: normal;
                color: var(--markdown-fg-bright);
            }

            h1,
            h2,
            h3,
            h4 {
                margin-top: toRem(24);
                margin-bottom: toRem(16);
                &:first-child {
                    margin-top: 0;
                }
            }

            p,
            ol,
            ul,
            hr,
            blockquote {
                margin-bottom: toRem(16);
                &:last-child {
                    margin-bottom: 0;
                }
            }

            ul,
            ol {
                padding-left: toRem(32);
            }

            ul li {
                list-style-type: disc;
            }

            ul li li {
                list-style-type: circle;
            }

            ul li li li {
                list-style-type: square;
            }

            ol li {
                list-style-type: decimal;
            }

            ol li li {
                list-style-type: lower-alpha;
            }

            ol li li li {
                list-style-type: lower-greek;
            }

            pre,
            code {
                font-family: Menlo, Monaco, "Courier New", monospace;
            }

            pre {
                padding: toRem(12);
                background-color: var(--markdown-bg-dark);
                overflow-x: auto;
            }

            blockquote {
                padding: 0 toRem(16);
                border-left: toRem(4) solid var(--markdown-fg-muted);
                color: var(--markdown-fg-muted);
            }

            a {
                text-decoration: underline;
            }

            img,
            canvas,
            iframe,
            video,
            svg,
            select,
            textarea {
                max-width: 100%;
            }

            &.suppressLinks {
                a {
                    pointer-events: none;
                    color: inherit;
                }
            }
        }
    }

    .markdown-wrapper:not(:empty) {
        display: inline;

        &:not(.inline) {
            display: block;
        }

        &.oneLine {
            display: block;
            @include ellipsis();
            word-wrap: break-word;
        }
    }
</style>
