<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";

    import type { UserSummary, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    export let prefix: string | undefined;
    export let offset: number;
    export let direction: "up" | "down" = "up";
    export let border = false;
    export let mentionSelf = false;

    let index = 0;
    $: userStore = client.userStore;
    $: itemHeight = $mobileWidth ? 53 : 55;
    $: borderWidth = direction === "up" ? 2 : 3;
    $: maxHeight =
        direction === "down" ? `${3.2 * itemHeight + borderWidth}px` : "calc(var(--vh, 1vh) * 50)";

    $: prefixLower = prefix?.toLowerCase();
    $: filtered = Object.values(client.getUserLookupForMentions()).filter(
        (user) =>
            (mentionSelf || user.userId !== currentUser.userId) &&
            (prefixLower === undefined ||
                user.username.toLowerCase().startsWith(prefixLower) ||
                (user.displayName !== undefined &&
                    user.displayName.toLowerCase().startsWith(prefixLower)))
    );

    $: style =
        direction === "up"
            ? `bottom: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`
            : `top: ${offset}px; height: ${
                  filtered.length * itemHeight + borderWidth
              }px; max-height: ${maxHeight}`;

    const dispatch = createEventDispatcher();

    function mention(user: UserSummary) {
        dispatch("mention", user);
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
                const user = filtered[index];
                if (user) {
                    mention(user);
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
                    <Avatar
                        url={client.userAvatarUrl($userStore[item.userId])}
                        userId={item.userId}
                        size={AvatarSize.Small} />
                </div>
                <div slot="text">
                    <span class="display-name">
                        {item.displayName ?? item.username}
                    </span>
                    <span class="username">
                        @{item.username}
                    </span>
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
        width: 100%;
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
            color: var(--txt-light);
        }
    }
    .avatar {
        margin-right: $sp3;
    }
</style>
