<script lang="ts">
    import { AvatarSize, UserStatus } from "../domain/user/user";

    export let url: string | undefined;
    export let status: UserStatus = UserStatus.Offline;
    export let size: AvatarSize = AvatarSize.Medium;
    export let blocked: boolean = false;
</script>

<div
    class="avatar"
    class:online={status === UserStatus.Online}
    class:offline={status === UserStatus.Offline}
    class:tiny={size === AvatarSize.Tiny}
    class:small={size === AvatarSize.Small}
    class:medium={size === AvatarSize.Medium}
    class:large={size === AvatarSize.Large}
    class:blocked
    style="background-image: url({url});" />

<style type="text/scss">
    .avatar {
        background-color: var(--avatar-bg);
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        border-radius: 50%;
        border: 2px solid var(--avatar-bd);
        position: relative;

        &.online {
            border: 2px solid limegreen;
        }

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
