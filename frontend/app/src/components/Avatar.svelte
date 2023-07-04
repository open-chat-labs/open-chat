<script lang="ts">
    import { AvatarSize, OpenChat, UserStatus } from "openchat-client";
    import { rtlStore } from "../stores/rtl";
    import { getContext } from "svelte";
    import { now } from "stores/time";

    const client = getContext<OpenChat>("client");

    export let url: string | undefined;
    export let showStatus: boolean | undefined = false;
    export let userId: string | undefined = undefined;
    export let size: AvatarSize = AvatarSize.Default;
    export let blocked: boolean = false;
    export let statusBorder = "white";
    export let selected = false;

    let userStatus = UserStatus.None;
    let userStatusUserId: string | undefined = undefined;
    $: {
        if (!showStatus || userId !== userStatusUserId) {
            userStatus = UserStatus.None;
            userStatusUserId = userId;
        }
        if (showStatus && userStatusUserId !== undefined) {
            client.getUserStatus(userStatusUserId, $now).then((status) => {
                if (userId === userStatusUserId) {
                    userStatus = status;
                }
            });
        }
    }
</script>

<div
    class="avatar"
    class:selected
    class:tiny={size === AvatarSize.Tiny}
    class:small={size === AvatarSize.Small}
    class:default={size === AvatarSize.Default}
    class:large={size === AvatarSize.Large}
    class:blocked
    style="background-image: url({url});">
    {#if userStatus === UserStatus.Online}
        <div class:rtl={$rtlStore} class="online" style={`box-shadow: ${statusBorder} 0 0 0 2px`} />
    {/if}
</div>

<style lang="scss">
    $online: limegreen;
    $status-size: 10px;

    .online {
        border-radius: 50%;
        width: $status-size;
        height: $status-size;
        background-color: $online;
        position: absolute;
        bottom: 0;
        &:not(.rtl) {
            right: 0;
        }
        &.rtl {
            left: 0;
        }
    }

    .avatar {
        background-color: var(--avatar-bg);
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        border-radius: 50%;
        position: relative;
        margin: 0 auto;
        transition: box-shadow 200ms ease-in-out;

        &.tiny {
            width: toRem(20);
            height: toRem(20);
        }

        &.small {
            width: toRem(35);
            height: toRem(35);
        }

        &.default {
            width: toRem(48);
            height: toRem(48);
        }

        &.large {
            width: toRem(150);
            height: toRem(150);
        }

        &.selected {
            box-shadow: 0 0 0 3px var(--icon-selected);
        }

        &.blocked::after {
            content: "";
            width: 4px;
            height: 100%;
            background-color: red;
            position: absolute;
            left: calc(50% - 2px);
            top: 0;
            transform: rotate(45deg);
            transform-origin: 50% 50%;
        }
    }
</style>
