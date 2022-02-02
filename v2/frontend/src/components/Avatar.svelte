<script lang="ts">
    import { AvatarSize, UserStatus } from "../domain/user/user";
    import { rtlStore } from "../stores/rtl";

    export let url: string | undefined;
    export let status: UserStatus = UserStatus.Offline;
    export let size: AvatarSize = AvatarSize.Medium;
    export let blocked: boolean = false;
    export let statusBorder = "white";
</script>

<div
    class="avatar"
    class:tiny={size === AvatarSize.Tiny}
    class:small={size === AvatarSize.Small}
    class:medium={size === AvatarSize.Medium}
    class:large={size === AvatarSize.Large}
    class:extra-large={size === AvatarSize.ExtraLarge}
    class:blocked
    style="background-image: url({url});">
    {#if status === UserStatus.Online}
        <div class:rtl={$rtlStore} class="online" style={`box-shadow: ${statusBorder} 0 0 0 2px`} />
    {/if}
</div>

<style type="text/scss">
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

        &.tiny {
            width: 35px;
            height: 35px;
        }

        &.small {
            width: 45px;
            height: 45px;
        }

        &.medium {
            width: 70px;
            height: 70px;
        }

        &.large {
            width: 100px;
            height: 100px;
        }

        &.extra-large {
            width: 150px;
            height: 150px;
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
