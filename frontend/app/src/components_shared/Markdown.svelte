<script lang="ts">
    import "highlight.js/styles/base16/helios.css";
    import type { OpenChat } from "@client";
    import { allUsersStore, userGroupSummariesStore } from "@client";
    import { getContext } from "svelte";
    import { isSingleEmoji } from "../utils/emojis";
    import {
        extractMentionedUserGroupIds,
        extractMentionedUserIds,
        renderMarkdown,
        sameMentionedUserGroups,
        sameMentionedUsers,
        type MentionedUser,
        type MentionedUserGroup,
    } from "./markdownRender";

    const client = getContext<OpenChat>("client");

    interface Props {
        text: string;
        inline?: boolean;
        oneLine?: boolean;
        twoLine?: boolean;
        threeLine?: boolean;
        suppressLinks?: boolean;
    }

    let {
        text,
        inline = true,
        oneLine = false,
        twoLine = false,
        threeLine = false,
        suppressLinks = false,
    }: Props = $props();

    const noUsers: MentionedUser[] = [];
    const noUserGroups: MentionedUserGroup[] = [];

    let singleEmoji = $derived(isSingleEmoji(text));

    // Only messages that actually contain a mention subscribe to the user /
    // user-group stores, and they only re-render when a mentioned name
    // changes: returning the previous array reference when nothing changed
    // stops Svelte propagating to the parse+sanitise derived below.
    let mentionedUserIds = $derived(extractMentionedUserIds(text));
    let mentionedUserGroupIds = $derived(extractMentionedUserGroupIds(text));

    let lastUsers = noUsers;
    let users = $derived.by(() => {
        if (mentionedUserIds.length === 0) return noUsers;
        const next: MentionedUser[] = [];
        for (const id of mentionedUserIds) {
            const u = $allUsersStore.get(id);
            if (u !== undefined) next.push({ id, userId: u.userId, username: u.username });
        }
        return sameMentionedUsers(next, lastUsers) ? lastUsers : (lastUsers = next);
    });

    let lastUserGroups = noUserGroups;
    let userGroups = $derived.by(() => {
        if (mentionedUserGroupIds.length === 0) return noUserGroups;
        const next: MentionedUserGroup[] = [];
        for (const id of mentionedUserGroupIds) {
            const g = $userGroupSummariesStore.get(id);
            if (g !== undefined) next.push({ id, groupId: g.id, name: g.name });
        }
        return sameMentionedUserGroups(next, lastUserGroups)
            ? lastUserGroups
            : (lastUserGroups = next);
    });

    let sanitized = $derived(
        renderMarkdown(
            {
                text: replaceDatetimes(client.stripLinkDisabledMarker(text)),
                inline,
                oneLine,
                suppressLinks,
                users,
                userGroups,
            },
            (msg, err) => client.logError(msg, err),
        ),
    );

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
    class:threeLine
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

        &.twoLine,
        &.threeLine {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            white-space: unset;
            overflow: hidden;
        }

        &.twoLine {
            -webkit-line-clamp: 2;
            line-clamp: 2;
        }

        &.threeLine {
            -webkit-line-clamp: 3;
            line-clamp: 3;
        }
    }

    .singleEmoji:not(.oneLine) {
        display: block;
        text-align: center;
        font-size: 3.5rem;
        line-height: 3.5rem;
        color: "inherit";
        @include pop(300ms);

        :global(custom-emoji) {
            height: 3.5rem;
        }
    }
</style>
