<script lang="ts">
    import { AvatarSize, UserStatus } from "../services/user";

    // import { UserStatus } from "../services/user";

    export let url = "";
    export let status: UserStatus = UserStatus.Offline;
    export let size: AvatarSize = AvatarSize.Medium;
</script>

<div
    class="avatar"
    class:online={status === UserStatus.Online}
    class:offline={status === UserStatus.Offline}
    class:busy={status === UserStatus.Busy}
    class:small={size === AvatarSize.Small}
    class:medium={size === AvatarSize.Medium}
    class:large={size === AvatarSize.Large}
    style="background-image: url({url});"
/>

<style type="text/scss">
    .avatar {
        background-color: #ffffff;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        border-radius: 50%;
        border: 1px solid var(--avatar-bd);
        box-shadow: var(--avatar-sh);
        position: relative;

        &.small {
            width: 40px;
            height: 40px;
        }

        &.medium {
            width: 70px;
            height: 70px;
        }

        &.large {
            width: 100px;
            height: 100px;
        }

        &::after {
            content: "";
            position: absolute;
            border-radius: 50%;
            border: 1px solid #fff;
            right: 0;
            bottom: 0;
            height: 8px;
            width: 8px;
        }

        &.online::after {
            background-color: greenyellow;
        }

        &.offline::after {
            background-color: #ccc;
        }

        &.busy::after {
            background-color: red;
        }

        &.small::after {
        }

        &.medium::after {
        }

        &.large::after {
            bottom: 6px;
            right: 6px;
            height: 15px;
            width: 15px;
        }
    }
</style>
