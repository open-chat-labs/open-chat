<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { AvatarSize, OpenChat, UserStatus } from "openchat-client";
    import { getContext } from "svelte";
    import { rtlStore } from "../stores/rtl";
    import { now } from "../stores/time";
    import LighteningBolt from "./home/nav/LighteningBolt.svelte";

    const client = getContext<OpenChat>("client");

    type Specialisation = "none" | "max_streak";

    interface Props {
        url: string | undefined;
        showStatus?: boolean | undefined;
        userId?: string | undefined;
        size?: AvatarSize;
        blocked?: boolean;
        statusBorder?: string;
        selected?: boolean;
        maxStreak?: boolean;
    }

    let {
        url,
        showStatus = false,
        userId = undefined,
        size = AvatarSize.Default,
        blocked = false,
        statusBorder = "white",
        selected = false,
        maxStreak = false,
    }: Props = $props();

    let specialisation: Specialisation = $derived(getSpecialisation());
    let userStatus = $state(UserStatus.None);
    let userStatusUserId: string | undefined = $state(undefined);

    function getSpecialisation(): Specialisation {
        if (maxStreak) return "max_streak";
        return "none";
    }

    trackedEffect("user-status", () => {
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
    });
</script>

<div
    class="avatar"
    class:selected
    class:tiny={size === AvatarSize.Tiny}
    class:small={size === AvatarSize.Small}
    class:default={size === AvatarSize.Default}
    class:large={size === AvatarSize.Large}
    class:blocked>
    <img alt="Avatar" class="avatar-image" src={url} loading="lazy" />
    {#if userStatus === UserStatus.Online}
        <div class:rtl={$rtlStore} class="online" style={`box-shadow: ${statusBorder} 0 0 0 2px`}>
        </div>
    {/if}
    {#if specialisation !== "none"}
        <div class="specialised" class:maxStreak class:rtl={$rtlStore}>
            {#if specialisation === "max_streak"}
                <LighteningBolt enabled />
            {/if}
        </div>
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

    .avatar-image {
        height: 100%;
        width: 100%;
        background-color: var(--avatar-bg);
        background-position: center;
        background-size: cover;
        border-radius: var(--avatar-rd);
        transition: filter 300ms ease-in-out;

        &:hover {
            filter: saturate(2);
        }
    }

    .avatar {
        position: relative;
        margin: 0 auto;
        transition: box-shadow 200ms ease-in-out;
        border-radius: var(--avatar-rd);

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

    .specialised {
        position: absolute;
        $offset: $avatar-mod-offset;
        &.maxStreak {
            $offset: calc($offset - 5px);
            transform: scale(0.85);
        }
        top: $offset;

        &:not(.rtl) {
            left: $offset;
        }
        &.rtl {
            right: $offset;
        }

        @include mobile() {
            $offset: $avatar-mod-offset-small;
            &.maxStreak {
                $offset: calc($offset - 5px);
            }
            top: $offset;
            &:not(.rtl) {
                left: $offset;
            }
            &.rtl {
                right: $offset;
            }
        }
    }
</style>
