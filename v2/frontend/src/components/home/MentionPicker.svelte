<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";

    import type { Participant } from "domain/chat/chat";
    import { userStore } from "stores/user";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "domain/user/user";
    import { avatarUrl } from "domain/user/user.utils";

    export let blockedUsers: Set<string>;
    export let participants: Participant[];
    export let prefix: string | undefined;
    export let offset: number;

    let index = 0;

    $: unblocked = participants.filter((p) => !blockedUsers.has(p.userId));

    $: filtered = unblocked.filter(
        (p) =>
            prefix === undefined || $userStore[p.userId]?.username?.toLowerCase().startsWith(prefix)
    );

    const dispatch = createEventDispatcher();

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

<div class="mention-picker" style={`bottom: ${offset}px; height: ${filtered.length * 50}px`}>
    <Menu>
        <VirtualList keyFn={(p) => p.userId} items={filtered} let:item let:itemIndex>
            <MenuItem selected={itemIndex === index} on:click={() => mention(item.userId)}>
                <div class="avatar" slot="icon">
                    <Avatar url={avatarUrl($userStore[item.userId])} size={AvatarSize.Tiny} />
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
        box-shadow: var(--menu-inverted-sh);
    }
    .avatar {
        margin-right: $sp4;
    }
</style>
