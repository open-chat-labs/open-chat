<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import At from "svelte-material-icons/At.svelte";

    import type { Participant } from "domain/chat/chat";
    import { userStore } from "stores/user";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "stores/iconSize";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize } from "domain/user/user";
    import { avatarUrl } from "domain/user/user.utils";

    export let participants: Participant[];
    export let prefix: string | undefined;

    let index = 0;

    $: filtered = participants.filter(
        (p) =>
            prefix === undefined || $userStore[p.userId]?.username?.toLowerCase().startsWith(prefix)
    );

    const dispatch = createEventDispatcher();

    // todo - this should use the virtual list
    // todo - the styling here is going to be very similar to a context menu. Is there something more generic to be extracted?
    function mention(userId: string) {
        dispatch("mention", userId);
    }

    function onKeyDown(ev: KeyboardEvent): void {
        console.log("Key: ", ev.key);
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

<div class="mention-picker">
    <Menu>
        {#each filtered as participant, i (participant.userId)}
            <MenuItem selected={index === i} on:click={() => mention(participant.userId)}>
                <div class="avatar" slot="icon">
                    <Avatar
                        url={avatarUrl($userStore[participant.userId])}
                        size={AvatarSize.Tiny} />
                </div>
                <!-- <At size={$iconSize} color={"var(--icon-txt)"} slot="icon" /> -->
                <div slot="text">{$userStore[participant.userId]?.username ?? $_("unknown")}</div>
            </MenuItem>
        {/each}
    </Menu>
</div>

<svelte:body on:keydown={onKeyDown} />

<style type="text/scss">
    :global(.mention-picker .menu) {
        bottom: 100px;
    }

    .avatar {
        margin-right: $sp4;
    }
</style>
