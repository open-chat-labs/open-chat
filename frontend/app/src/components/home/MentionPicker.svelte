<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import {
        userStore,
        currentUser,
        currentCommunityMembers as communityMembers,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import { iconSize } from "../../stores/iconSize";

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
        onClose,
        onMention,
    }: Props = $props();

    let index = $state(0);
    let usersAndGroups: UserOrUserGroup[] = $state([]);

    onMount(() => {
        usersAndGroups = Object.values(client.getUserLookupForMentions()).sort(
            (a: UserOrUserGroup, b: UserOrUserGroup) => {
                const order = { everyone: 1, user_group: 2, user: 3, bot: 4 };
                return order[a.kind] - order[b.kind];
            },
        );
    });

    function mention(userOrGroup: UserOrUserGroup) {
        onMention(userOrGroup);
    }

    function onKeyDown(ev: KeyboardEvent): void {
        switch (ev.key) {
            case "ArrowDown":
                index = (index + 1) % filtered.length;
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "ArrowUp":
                index = index === 0 ? filtered.length - 1 : index - 1;
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Escape":
                onClose();
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Enter":
                const userOrGroup = filtered[index];
                if (userOrGroup) {
                    mention(userOrGroup);
                }
                ev.preventDefault();
                ev.stopPropagation();
                break;
        }
    }

    function compareMatchNames(a: string, b: string): number {
        // Order by length, then alphabetically
        if (a === b) return 0;
        if (a.length === b.length) {
            return a < b ? -1 : 1;
        }
        return a.length < b.length ? -1 : 1;
    }
    let itemHeight = $derived($mobileWidth ? 53 : 55);
    let borderWidth = $derived(direction === "up" ? 2 : 3);
    let maxHeight = $derived(
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)",
    );
    let prefixLower = $derived(prefix?.toLowerCase());
    let filtered = $derived(
        usersAndGroups
            .filter((userOrGroup) => {
                switch (userOrGroup.kind) {
                    case "user_group":
                        return (
                            !usersOnly &&
                            (prefixLower === undefined ||
                                (supportsUserGroups &&
                                    userOrGroup.name.toLowerCase().startsWith(prefixLower)))
                        );
                    case "everyone": {
                        return (
                            !usersOnly &&
                            (prefixLower === undefined || userOrGroup.kind.startsWith(prefixLower))
                        );
                    }
                    default:
                        return (
                            (mentionSelf || userOrGroup.userId !== $currentUser.userId) &&
                            (prefixLower === undefined ||
                                userOrGroup.username.toLowerCase().startsWith(prefixLower) ||
                                userOrGroup.displayName?.toLowerCase().startsWith(prefixLower))
                        );
                }
            })
            .sort((a, b) => {
                // 'everyone' first, then user groups, then users
                if (a.kind === "everyone") return -1;
                if (b.kind === "everyone") return 1;

                if (a.kind === "user_group" && b.kind === "user_group") {
                    return compareMatchNames(a.name, b.name);
                }
                if (a.kind === "user" && b.kind === "user") {
                    return compareMatchNames(a.username, b.username);
                }
                return a.kind === "user_group" ? -1 : 1;
            }),
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

    function userOrGroupKey(u: UserOrUserGroup): string {
        switch (u.kind) {
            case "user_group":
                return u.id.toString();
            case "everyone":
                return "everyone";
            default:
                return u.userId;
        }
    }
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
                                        url={client.userAvatarUrl($userStore.get(item.userId))}
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
                                        {client.getDisplayName(item, $communityMembers)}
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
