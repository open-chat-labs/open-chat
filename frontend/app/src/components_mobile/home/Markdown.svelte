<script lang="ts">
    import "highlight.js/styles/base16/helios.css";
    import { marked } from "marked";
    import type { OpenChat, ReadonlyMap, UserGroupSummary } from "openchat-client";
    import { allUsersStore, userGroupSummariesStore } from "openchat-client";
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
                // Don't replace UserIds yet - just mark them
                replaceDatetimes(client.stripLinkDisabledMarker(text)),
                $userGroupSummariesStore,
            ),
        );
        try {
            if (inline) {
                parsed = marked.parseInline(parsed, options) as string;
            } else {
                parsed = marked.parse(parsed, options) as string;
            }

            // replace userIds & emojis *after* markdown parsing so that we can fully disallow html in the markdown source
            parsed = replaceUserIds(parsed);
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
            const u = $allUsersStore.get(p1);
            if (u !== undefined) {
                return `<profile-link text="${escapeHtml(u.username)}" user-id="${
                    u.userId
                }" suppress-links="${suppressLinks}"></profile-link>`;
            }
            return match;
        });
    }

    function escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function replaceUserGroupIds(
        text: string,
        userGroups: ReadonlyMap<number, UserGroupSummary>,
    ): string {
        return text.replace(/@UserGroup\(([\d]+)\)/g, (match, p1) => {
            const u = userGroups.get(Number(p1));
            if (u !== undefined) {
                return `**[@${escapeHtml(u.name)}](?usergroup=${u.id})**`;
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
            overflow: hidden;
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
