<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";

    import type { Member, PartialUserSummary, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { mobileWidth } from "../../stores/screenDimensions";

    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let blockedUsers: Set<string>;
    export let members: Member[];
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

    $: unblocked = members.filter(
        (m) => !blockedUsers.has(m.userId) && (mentionSelf || m.userId !== user.userId)
    );

    $: reverseLookup = unblocked.reduce((lookup, u) => {
        const user = $userStore[u.userId];
        if (user !== undefined && user.username !== undefined) {
            lookup[user.username.toLowerCase()] = user;
        }
        return lookup;
    }, {} as Record<string, PartialUserSummary>);

    $: filtered = unblocked.filter(
        (p) =>
            prefix === undefined ||
            $userStore[p.userId]?.username?.toLowerCase().startsWith(prefix?.toLowerCase())
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

    export function userFromUsername(username: string): PartialUserSummary | undefined {
        return reverseLookup[username.toLowerCase()];
    }

    function mention(userId: string) {
        dispatch("mention", userId);
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
                    mention(user.userId);
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
    <Menu>
        <VirtualList keyFn={(p) => p.userId} items={filtered} let:item let:itemIndex>
            <MenuItem selected={itemIndex === index} on:click={() => mention(item.userId)}>
                <div class="avatar" slot="icon">
                    <Avatar
                        url={client.userAvatarUrl($userStore[item.userId])}
                        userId={item.userId}
                        size={AvatarSize.Default} />
                </div>
                <div slot="text">
                    {$userStore[item.userId]?.username ?? $_("unknown")}
                </div>
            </MenuItem>
        </VirtualList>
    </Menu>
</div>

<svelte:body on:keydown={onKeyDown} />

<style type="text/scss">
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
    }
    .avatar {
        margin-right: $sp4;
    }
</style>
