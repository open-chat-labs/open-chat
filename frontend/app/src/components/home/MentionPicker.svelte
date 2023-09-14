<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";

    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import { iconSize } from "../../stores/iconSize";

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    export let prefix: string | undefined;
    export let offset: number;
    export let direction: "up" | "down" = "up";
    export let border = false;
    export let mentionSelf = false;
    export let supportsUserGroups = false;

    let index = 0;
    let usersAndGroups: UserOrUserGroup[] = [];

    $: userStore = client.userStore;
    $: communityMembers = client.currentCommunityMembers;
    $: itemHeight = $mobileWidth ? 53 : 55;
    $: borderWidth = direction === "up" ? 2 : 3;
    $: maxHeight =
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)";

    $: prefixLower = prefix?.toLowerCase();

    $: filtered = usersAndGroups.filter((userOrGroup) => {
        switch (userOrGroup.kind) {
            case "user_group":
                return (
                    prefixLower === undefined ||
                    (supportsUserGroups && userOrGroup.name.toLowerCase().startsWith(prefixLower))
                );
            default:
                return (
                    (mentionSelf || userOrGroup.userId !== currentUser.userId) &&
                    (prefixLower === undefined ||
                        userOrGroup.username.toLowerCase().startsWith(prefixLower) ||
                        userOrGroup.displayName?.toLowerCase().startsWith(prefixLower))
                );
        }
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
        usersAndGroups = Object.values(client.getUserLookupForMentions());
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
</script>

<div
    class="mention-picker"
    class:up={direction === "up"}
    class:down={direction === "down"}
    class:border
    {style}>
    <Menu fit>
        <VirtualList keyFn={(p) => p.userId} items={filtered} let:item let:itemIndex>
            <MenuItem selected={itemIndex === index} on:click={() => mention(item)}>
                <div class="avatar" slot="icon">
                    {#if item.kind === "user_group"}
                        <div class="group-icon">
                            <AccountMultiple color={"var(--menu-disabled-txt)"} size={$iconSize} />
                        </div>
                    {:else}
                        <Avatar
                            url={client.userAvatarUrl($userStore[item.userId])}
                            userId={item.userId}
                            size={AvatarSize.Small} />
                    {/if}
                </div>
                <div slot="text">
                    {#if item.kind === "user_group"}
                        <span class="display-name">
                            {item.name}
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

        &.up {
            box-shadow: var(--menu-inverted-sh);
        }

        &.down {
            box-shadow: var(--menu-sh);
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
