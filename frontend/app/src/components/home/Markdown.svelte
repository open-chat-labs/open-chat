<script lang="ts">
    import { marked } from "marked";
    import { getContext } from "svelte";
    import type { OpenChat, UserGroupSummary } from "openchat-client";
    import { userStore, userGroupSummaries as userGroups } from "openchat-client";
    import { DOMPurifyDefault, DOMPurifyOneLine } from "../../utils/domPurify";
    import { isSingleEmoji } from "../../utils/emojis";

    const client = getContext<OpenChat>("client");
    interface Props {
        text: string;
        inline?: boolean;
        oneLine?: boolean;
        twoLine?: boolean;
        suppressLinks?: boolean;
    }

    let {
        text,
        inline = true,
        oneLine = false,
        twoLine = false,
        suppressLinks = false,
    }: Props = $props();

    let sanitized = $state("unsafe");

    let singleEmoji = $derived(isSingleEmoji(text));
    let options = $derived({
        breaks: !oneLine,
    });

    function replaceUserIds(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $userStore.get(p1);
            if (u !== undefined) {
                return `<profile-link text="${u.username}" user-id="${u.userId}" suppress-links="${suppressLinks}"></profile-link>`;
            }
            return match;
        });
    }

    function replaceUserGroupIds(text: string, userGroups: Map<number, UserGroupSummary>): string {
        return text.replace(/@UserGroup\(([\d]+)\)/g, (match, p1) => {
            const u = userGroups.get(Number(p1));
            if (u !== undefined) {
                return `**[@${u.name}](?usergroup=${u.id})**`;
            } else {
                console.warn("Unable to find user group: ", match);
                return `**@unknown_user_group**`;
            }
        });
    }

    function replaceEveryone(text: string): string {
        if (!text.includes("@everyone")) return text;
        return text.replace(/(^|\W)(@everyone)($|\W)/gm, "$1[**$2**](?everyone)$3");
    }

    function replaceDatetimes(text: string): string {
        return text.replace(/@DateTime\((\d+)\)/g, (_, p1) => {
            return client.toDatetimeString(new Date(Number(p1)));
        });
    }

    $effect(() => {
        let parsed = replaceEveryone(
            replaceUserGroupIds(
                replaceUserIds(replaceDatetimes(client.stripLinkDisabledMarker(text))),
                $userGroups,
            ),
        );
        try {
            if (inline) {
                parsed = marked.parseInline(parsed, options) as string;
                console.log("Parsed text: ", parsed);
            } else {
                parsed = marked.parse(parsed, options) as string;
            }
        } catch (err: any) {
            client.logError("Error parsing markdown: ", err);
        }

        const domPurify = oneLine ? DOMPurifyOneLine : DOMPurifyDefault;
        try {
            sanitized = domPurify.sanitize(parsed);
            console.log("Sanitized text: ", sanitized);
        } catch (err: any) {
            client.logError("Error sanitizing message content: ", err);
        }
    });
</script>

<p
    class="markdown-wrapper"
    class:inline
    class:oneLine
    class:twoLine
    class:suppressLinks
    class:singleEmoji>
    {@html sanitized}
</p>

<style lang="scss">
    :global {
        .markdown-wrapper {
            h1 {
                @include font(bold, normal, fs-130);
            }

            h2 {
                @include font(bold, normal, fs-120);
            }

            h3 {
                @include font(bold, normal, fs-110);
            }

            h1,
            h2,
            h3,
            h4 {
                color: "inherit";
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
            pre,
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

            code {
                color: var(--code-txt);
                background-color: var(--code-bg);
                padding: 3px 5px;
                border-radius: 4px;
            }

            pre {
                padding: toRem(16);
                overflow-x: auto;
                border-radius: $sp2;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background-color: var(--code-bg);
                color: var(--code-txt);

                code {
                    background-color: transparent;
                    padding: 0;
                }
            }

            blockquote {
                padding: 0 toRem(16);
                border-left: toRem(4) solid var(--bd);
                color: var(--txt-light);
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
            table,
            textarea {
                max-width: 100%;
            }

            table {
                width: 100%;
                margin-bottom: toRem(8);
            }

            td,
            th {
                padding: toRem(8);
                border: 1px solid var(--code);
            }

            th {
                font-weight: 500;
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

        &.twoLine {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
            white-space: unset;
        }
    }

    .singleEmoji:not(.oneLine) {
        display: block;
        text-align: center;
        font-size: 3.5rem;
        line-height: 3.5rem;
        color: "inherit";
        @include pop(300ms);
    }
</style>
