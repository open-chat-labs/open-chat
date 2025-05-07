<script lang="ts">
    import { marked } from "marked";
    import type { OpenChat, ReadonlyMap, UserGroupSummary } from "openchat-client";
    import { app, userStore } from "openchat-client";
    import { getContext } from "svelte";
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

    let singleEmoji = $derived(isSingleEmoji(text));
    let options = $derived({
        breaks: !oneLine,
    });

    let sanitized = $derived.by(() => {
        let parsed = replaceEveryone(
            replaceUserGroupIds(
                replaceUserIds(replaceDatetimes(escapeBackwardSlashes(client.stripLinkDisabledMarker(text)))),
                app.userGroupSummaries,
            ),
        );
        try {
            if (inline) {
                parsed = marked.parseInline(parsed, options) as string;
            } else {
                parsed = marked.parse(parsed, options) as string;
            }
        } catch (err: any) {
            client.logError("Error parsing markdown: ", err);
        }

        const domPurify = oneLine ? DOMPurifyOneLine : DOMPurifyDefault;
        try {
            return domPurify.sanitize(parsed);
        } catch (err: any) {
            client.logError("Error sanitizing message content: ", err);
            return "unsafe";
        }
    });

    function replaceUserIds(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = userStore.get(p1);
            if (u !== undefined) {
                return `<profile-link text="${u.username}" user-id="${u.userId}" suppress-links="${suppressLinks}"></profile-link>`;
            }
            return match;
        });
    }

    function replaceUserGroupIds(
        text: string,
        userGroups: ReadonlyMap<number, UserGroupSummary>,
    ): string {
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
        return text.replace(/(^|\W)(@everyone)($|\W)/gm, "$1**[$2](?everyone)**$3");
    }

    function replaceDatetimes(text: string): string {
        return text.replace(/@DateTime\((\d+)\)/g, (_, p1) => {
            return client.toDatetimeString(new Date(Number(p1)));
        });
    }

    function escapeBackwardSlashes(text: string): string {
        return text.replaceAll("\\", "\\\\");
    }
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
