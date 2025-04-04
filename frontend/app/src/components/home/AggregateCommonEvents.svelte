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

    interface Props {
        chatId: ChatIdentifier;
        user: UserSummary | undefined;
        joined: Set<string>;
        messagesDeleted: number[];
        rolesChanged: Map<string, Map<MemberRole, Set<string>>>;
        observer: IntersectionObserver;
        readByMe: boolean;
        level: Level;
    }

    let { chatId, user, joined, messagesDeleted, rolesChanged, observer, readByMe, level }: Props =
        $props();

    let deletedMessagesElement: HTMLElement | undefined = $state();

    const client = getContext<OpenChat>("client");

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
    let joinedText = $derived(buildJoinedText($userStore, joined));
    let deletedText = $derived(
        messagesDeleted.length > 0
            ? messagesDeleted.length === 1
                ? $_("oneMessageDeleted")
                : $_("nMessagesDeleted", { values: { number: messagesDeleted.length } })
            : undefined,
    );
    let roleChangedTextList = $derived(buildRoleChangedTextList($userStore, rolesChanged));
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
                onclick={expandDeletedMessages}>
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
