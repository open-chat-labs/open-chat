<script lang="ts">
    import MenuItem from "../MenuItemLegacy.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import {
        userStore,
        currentUser,
        currentCommunityMembers as communityMembers,
    } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import { iconSize } from "../../stores/iconSize";

    const client = getContext<OpenChat>("client");

    export let prefix: string | undefined;
    export let offset: number;
    export let direction: "up" | "down" = "up";
    export let border = false;
    export let mentionSelf = false;
    export let supportsUserGroups = false;
    export let usersOnly = false;
    export let inline = false;

    let index = 0;
    let usersAndGroups: UserOrUserGroup[] = [];

    $: itemHeight = $mobileWidth ? 53 : 55;
    $: borderWidth = direction === "up" ? 2 : 3;
    $: maxHeight =
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)";

    $: prefixLower = prefix?.toLowerCase();

    $: filtered = usersAndGroups
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
        });

    $: style =
        direction === "up"
            ? `bottom: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`
            : `top: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`;

    onMount(() => {
        usersAndGroups = Object.values(client.getUserLookupForMentions()).sort(
            (a: UserOrUserGroup, b: UserOrUserGroup) => {
                const order = { everyone: 1, user_group: 2, user: 3, bot: 4 };
                return order[a.kind] - order[b.kind];
            },
        );
    });

    const dispatch = createEventDispatcher();

    function mention(userOrGroup: UserOrUserGroup) {
        dispatch("mention", userOrGroup);
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
                dispatch("close");
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
            <VirtualList keyFn={(p) => p.userId} items={filtered} let:item let:itemIndex>
                <MenuItem selected={itemIndex === index} onclick={() => mention(item)}>
                    <div class="avatar" slot="icon">
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
                    <div slot="text">
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
                </MenuItem>
            </VirtualList>
        </Menu>
    </div>
{/if}

<svelte:body on:keydown={onKeyDown} />

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
