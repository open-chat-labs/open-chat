<svelte:options immutable={true} />

<script lang="ts">
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import { _ } from "svelte-i18n";
    import { getMembersString } from "../../domain/chat/chat.utils";
    import { compareIsNotYouThenUsername, compareUsername } from "../../domain/user/user.utils";
    import { userStore } from "../../stores/user";

    export let user: UserSummary | undefined;
    export let joined: Set<string>;
    export let left: Set<string>;

    $: joinedText = buildText($userStore, joined, "userJoined");
    $: leftText = buildText($userStore, left, "userLeft");

    function buildText(
        userStore: UserLookup,
        userIds: Set<string>,
        template: string
    ): string | undefined {
        return userIds.size !== 0
            ? $_(template, {
                  values: {
                      username: buildUserList(userStore, userIds),
                  },
              })
            : undefined;
    }

    function buildUserList(userStore: UserLookup, userIds: Set<string>): string {
        return getMembersString(
            user!,
            userStore,
            Array.from(userIds),
            $_("unknownUser"),
            $_("you"),
            user ? compareIsNotYouThenUsername(user.userId) : compareUsername,
            false
        );
    }
</script>

{#if joinedText !== undefined || leftText !== undefined}
    <div class="timeline-event">
        {#if joinedText !== undefined}
            <p>{joinedText}</p>
        {/if}
        {#if leftText !== undefined}
            <p>{leftText}</p>
        {/if}
    </div>
{/if}

<style type="text/scss">
    .timeline-event {
        max-width: 80%;
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);

        p {
            margin-bottom: $sp3;
            &:last-child {
                margin-bottom: 0;
            }
        }
    }
</style>
