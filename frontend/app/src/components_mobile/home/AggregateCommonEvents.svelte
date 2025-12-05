<script lang="ts">
    import { Caption, Container } from "component-lib";
    import type { Level, MemberRole, OpenChat, UserLookup, UserSummary } from "openchat-client";
    import { allUsersStore, roleAsText } from "openchat-client";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { buildDisplayName } from "../../utils/user";
    import Markdown from "./Markdown.svelte";

    interface Props {
        user: UserSummary | undefined;
        joined: Set<string>;
        messagesDeleted: number[];
        rolesChanged: Map<string, Map<MemberRole, Set<string>>>;
        observer?: IntersectionObserver;
        readByMe: boolean;
        level: Level;
    }

    let { user, joined, messagesDeleted, rolesChanged, observer, readByMe, level }: Props =
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
            const changedByStr = buildDisplayName(userStore, changedBy, me ? "me" : "user");

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
                newRole: $_(roleAsText(newRole)),
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
        client.expandDeletedMessages(new Set(messagesDeleted));
    }
    let joinedText = $derived(buildJoinedText($allUsersStore, joined));
    let deletedText = $derived(
        messagesDeleted.length > 0
            ? messagesDeleted.length === 1
                ? $_("oneMessageDeleted")
                : $_("nMessagesDeleted", { values: { number: messagesDeleted.length } })
            : undefined,
    );
    let roleChangedTextList = $derived(buildRoleChangedTextList($allUsersStore, rolesChanged));
</script>

{#if joinedText !== undefined || deletedText !== undefined || roleChangedTextList?.length > 0}
    <Container padding={"sm"} crossAxisAlignment={"center"} direction={"vertical"}>
        {#if joinedText !== undefined}
            <Caption width={"hug"} colour={"textSecondary"}>
                <Markdown oneLine suppressLinks text={joinedText} />
            </Caption>
        {/if}
        {#if deletedText !== undefined}
            <div
                bind:this={deletedMessagesElement}
                data-index={messagesDeleted.join(" ")}
                class="deleted">
                <Container onClick={expandDeletedMessages}>
                    <Caption width={"hug"} colour={"textSecondary"}>
                        {deletedText}
                    </Caption>
                </Container>
            </div>
        {/if}
        {#each roleChangedTextList as text}
            <Caption width={"hug"} colour={"textSecondary"}>
                <Markdown suppressLinks {text} />
            </Caption>
        {/each}
    </Container>
{/if}
