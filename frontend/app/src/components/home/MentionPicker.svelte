<script lang="ts">
    import VirtualList from "@openchat/ui/src/lib/virtual/VirtualList.svelte";
    import type { OpenChat, UserOrUserGroup, UserSummary } from "@client";
    import {
        allUsersStore,
        AvatarSize,
        currentUserIdStore,
        iconSize,
        mentionCandidateKey,
        mentionCandidates,
        mobileWidth,
        selectedChatMembersStore,
        selectedCommunityMembersStore,
    } from "@client";
    import { getContext } from "svelte";
    import { MemberFinder } from "@src/logic/composer/composer";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Avatar from "../Avatar.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        prefix: string | undefined;
        offset: number;
        direction?: "up" | "down";
        border?: boolean;
        mentionSelf?: boolean;
        supportsUserGroups?: boolean;
        usersOnly?: boolean;
        inline?: boolean;
        // Offered instead of the selected chat's members
        users?: UserSummary[];
        // Users not offered, by id
        hidden?: string[];
        onMention: (user: UserOrUserGroup) => void;
        onClose: () => void;
    }

    let {
        prefix,
        offset,
        direction = "up",
        border = false,
        mentionSelf = false,
        supportsUserGroups = false,
        usersOnly = false,
        inline = false,
        users,
        hidden = [],
        onClose,
        onMention,
    }: Props = $props();

    // The item highlighted, by its key, since the list changes as more is typed and as members who
    // weren't held are found
    let highlighted: string | undefined = $state();

    // Rebuilt when the members change, which they do when those which weren't held are found
    let usersAndGroups = $derived.by(() => {
        if (users !== undefined) return users;
        void [$selectedChatMembersStore, $selectedCommunityMembersStore, $allUsersStore];
        return Object.values(client.getUserLookupForMentions());
    });

    // A chat which holds only some of its members is searched for those matching what has been
    // typed
    const finder = new MemberFinder((searchFor) => client.findMembersToMention(searchFor));
    $effect(() => {
        finder.typed(users === undefined ? prefix : undefined);
        return () => finder.cancel();
    });

    function mention(userOrGroup: UserOrUserGroup) {
        onMention($state.snapshot(userOrGroup));
    }

    function onKeyDown(ev: KeyboardEvent): void {
        switch (ev.key) {
            case "ArrowDown":
                highlight((index + 1) % filtered.length);
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "ArrowUp":
                highlight(index === 0 ? filtered.length - 1 : index - 1);
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Escape":
                onClose();
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Enter": {
                const userOrGroup = filtered[index];
                if (userOrGroup) {
                    mention(userOrGroup);
                }
                ev.preventDefault();
                ev.stopPropagation();
                break;
            }
        }
    }

    function highlight(i: number) {
        const item = filtered[i];
        highlighted = item === undefined ? undefined : userOrGroupKey(item);
    }

    let itemHeight = $derived($mobileWidth ? 53 : 55);
    let borderWidth = $derived(direction === "up" ? 2 : 3);
    let maxHeight = $derived(
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)",
    );
    let filtered = $derived(
        mentionCandidates(usersAndGroups, prefix, {
            me: $currentUserIdStore,
            mentionSelf,
            supportsUserGroups,
            usersOnly,
            // users given are kept in the order given
            keepUserOrder: users !== undefined,
        }).filter((u) => !("userId" in u && hidden.includes(u.userId))),
    );
    let index = $derived(
        Math.max(
            0,
            filtered.findIndex((u) => userOrGroupKey(u) === highlighted),
        ),
    );
    let style = $derived(
        direction === "up"
            ? `bottom: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`
            : `top: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`,
    );

    const userOrGroupKey = mentionCandidateKey;
</script>

{#if filtered.length > 0}
    <div
        class="mention-picker"
        class:up={direction === "up"}
        class:down={direction === "down"}
        class:inline
        class:border
        {style}>
        <Menu fit>
            <VirtualList keyFn={userOrGroupKey} items={filtered}>
                {#snippet children(item, itemIndex)}
                    <MenuItem selected={itemIndex === index} onclick={() => mention(item)}>
                        {#snippet icon()}
                            <div class="avatar">
                                {#if item.kind === "user_group" || item.kind === "everyone"}
                                    <div class="group-icon">
                                        <AccountMultiple
                                            color={"var(--menu-disabled-txt)"}
                                            size={$iconSize} />
                                    </div>
                                {:else}
                                    <Avatar
                                        url={client.userAvatarUrl($allUsersStore.get(item.userId))}
                                        userId={item.userId}
                                        size={AvatarSize.Small} />
                                {/if}
                            </div>
                        {/snippet}
                        {#snippet text()}
                            <div>
                                {#if item.kind === "user_group"}
                                    <span class="display-name">
                                        {item.name}
                                    </span>
                                {:else if item.kind === "everyone"}
                                    <span class="display-name">
                                        {"everyone"}
                                    </span>
                                {:else}
                                    <span class="display-name">
                                        {client.getDisplayName(
                                            item.userId,
                                            $selectedCommunityMembersStore,
                                        )}
                                    </span>
                                    <span class="username">
                                        @{item.username}
                                    </span>
                                {/if}
                            </div>
                        {/snippet}
                    </MenuItem>
                {/snippet}
            </VirtualList>
        </Menu>
    </div>
{/if}

<svelte:body onkeydown={onKeyDown} />

<style lang="scss">
    :global(.mention-picker .menu) {
        box-shadow: none;
        position: relative;
        width: 100%;
        height: 100%;
        @include z-index("footer-overlay");
    }

    .mention-picker {
        position: absolute;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        z-index: 10000;
        left: 0;

        &.up {
            box-shadow: var(--menu-inverted-sh);
        }

        &.down {
            box-shadow: var(--menu-sh);
        }

        &.inline {
            position: relative;
            box-shadow: none;
        }

        &.border {
            border: 1px solid var(--bd);
            border-top: none;
        }

        .display-name {
            font-weight: 500;
        }

        .username {
            font-weight: 200;
            color: var(--menu-disabled-txt);
        }
    }
    .avatar {
        margin-right: $sp3;
    }

    .group-icon {
        width: toRem(35);
        height: toRem(35);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--menu-bg);
        border-radius: 50%;
    }
</style>
