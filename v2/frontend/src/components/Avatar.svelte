<script lang="ts">
    import { AvatarSize, UserStatus } from "../domain/user/user";

    export let url: string | undefined;
    export let status: UserStatus = UserStatus.Offline;
    export let size: AvatarSize = AvatarSize.Medium;
</script>

<div
    class="avatar"
    class:online={status === UserStatus.Online}
    class:offline={status === UserStatus.Offline}
    class:tiny={size === AvatarSize.Tiny}
    class:small={size === AvatarSize.Small}
    class:medium={size === AvatarSize.Medium}
    class:large={size === AvatarSize.Large}
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

        &.online::after {
            background-color: limegreen;
        }

        &.offline::after {
            background-color: #ccc;
        }

        &.large::after {
            bottom: 6px;
            right: 6px;
            height: 15px;
            width: 15px;
        }
    }
</style>
