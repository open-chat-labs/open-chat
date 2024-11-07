<svelte:options immutable />

<script lang="ts">
    import type {
        ChatIdentifier,
        MemberRole,
        Level,
        OpenChat,
        UserLookup,
        UserSummary,
    } from "openchat-client";
    import { userStore } from "openchat-client";
    import { getContext, onDestroy, onMount } from "svelte";
    import { buildDisplayName } from "../../utils/user";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";

    export let chatId: ChatIdentifier;
    export let user: UserSummary | undefined;
    export let joined: Set<string>;
    export let messagesDeleted: number[];
    export let rolesChanged: Map<string, Map<MemberRole, Set<string>>>;
    export let observer: IntersectionObserver;
    export let readByMe: boolean;
    export let level: Level;

    let deletedMessagesElement: HTMLElement;

    const client = getContext<OpenChat>("client");

    $: joinedText = buildJoinedText($userStore, joined);
    $: deletedText =
        messagesDeleted.length > 0
            ? messagesDeleted.length === 1
                ? $_("oneMessageDeleted")
                : $_("nMessagesDeleted", { values: { number: messagesDeleted.length } })
            : undefined;
    $: roleChangedTextList = buildRoleChangedTextList($userStore, rolesChanged);

    onMount(() => {
        if (!readByMe && deletedMessagesElement) {
            observer?.observe(deletedMessagesElement);
        }
    });

    onDestroy(() => {
        if (deletedMessagesElement) {
            observer?.unobserve(deletedMessagesElement);
        }
    });

    function buildJoinedText(userStore: UserLookup, userIds: Set<string>): string | undefined {
        return userIds.size > 10
            ? interpolate(
                  $_,
                  i18nKey(
                      "nUsersJoined",
                      {
                          number: userIds.size.toString(),
                      },
                      level,
                      true,
                  ),
              )
            : userIds.size > 0
              ? interpolate(
                    $_,
                    i18nKey(
                        "userJoined",
                        {
                            username: buildUserList(userStore, Array.from(userIds)),
                        },
                        level,
                        true,
                    ),
                )
              : undefined;
    }

    function buildRoleChangedTextList(
        userStore: UserLookup,
        rolesChanged: Map<string, Map<MemberRole, Set<string>>>,
    ): string[] {
        return [...rolesChanged.entries()].flatMap(([changedBy, changedByMap]) => {
            const me = changedBy === user?.userId;
            const changedByStr = buildDisplayName(userStore, changedBy, me);

            return [...changedByMap.entries()].flatMap(([newRole, userIds]) =>
                buildRoleChangedText(userStore, changedByStr, newRole, Array.from(userIds)),
            );
        });
    }

    function buildRoleChangedText(
        userStore: UserLookup,
        changedBy: string,
        newRole: MemberRole,
        userIds: string[],
    ): string {
        const meChanged = userIds.length == 1 && userIds[0] === user?.userId;
        const members = buildUserList(userStore, userIds);

        return $_(meChanged ? "yourRoleChanged" : "roleChanged", {
            values: {
                changed: members,
                changedBy,
                newRole: $_(newRole),
            },
        });
    }

    function buildUserList(userStore: UserLookup, userIds: string[]): string {
        return client.getMembersString(
            user!,
            userStore,
            userIds,
            $_("unknownUser"),
            $_("you"),
            user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername,
            false,
        );
    }

    function expandDeletedMessages() {
        client.expandDeletedMessages(chatId, new Set(messagesDeleted));
    }
</script>

{#if joinedText !== undefined || deletedText !== undefined || roleChangedTextList?.length > 0}
    <div class="timeline-event">
        {#if joinedText !== undefined}
            <p>
                <Markdown oneLine suppressLinks text={joinedText} />
            </p>
        {/if}
        {#if deletedText !== undefined}
            <p
                class="deleted"
                title={$_("expandDeletedMessages")}
                bind:this={deletedMessagesElement}
                data-index={messagesDeleted.join(" ")}
                on:click={expandDeletedMessages}>
                {deletedText}
            </p>
        {/if}
        {#each roleChangedTextList as text}
            <p>
                <Markdown suppressLinks {text} />
            </p>
        {/each}
    </div>
{/if}

<style lang="scss">
    .timeline-event {
        max-width: 80%;
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: 0 auto $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);

        p {
            margin-bottom: $sp3;
            &:last-child {
                margin-bottom: 0;
            }

            @media (hover: hover) {
                &.deleted:hover {
                    cursor: pointer;
                    text-decoration: underline;
                }
            }
        }
    }
</style>
