<script lang="ts">
    import { _ } from "svelte-i18n";
    import { emptyUnreadCounts } from "openchat-client";
    import UnreadCount from "../UnreadCount.svelte";
    import type { ResourceKey, UnreadCounts } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import VideoCallIcon from "../video/VideoCallIcon.svelte";
    import WithVerifiedBadge from "../../icons/WithVerifiedBadge.svelte";

    interface Props {
        label: ResourceKey;
        selected?: boolean;
        separator?: boolean;
        unread?: UnreadCounts;
        video?: { muted: 0; unmuted: 0 };
        children?: import("svelte").Snippet;
        onClick?: () => void;
        verified?: boolean;
    }

    let {
        label,
        selected = false,
        separator = false,
        unread = emptyUnreadCounts(),
        video = { muted: 0, unmuted: 0 },
        children,
        onClick,
        verified = false,
    }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    role="button"
    tabindex="0"
    class:separator
    class:selected
    class="left-nav-item"
    onclick={onClick}>
    <div class="icon" title={$_(label.key, label.params)}>
        {@render children?.()}
        <UnreadCount {unread} />
        <VideoCallIcon {video} />
    </div>
    <WithVerifiedBadge {verified} size={"small"}>
        <div class="label"><Translatable resourceKey={label} /></div>
    </WithVerifiedBadge>
</div>

<style lang="scss">
    :global(.left-nav-item .unread-count) {
        right: toRem(-9);
        top: 85%;
        @include mobile() {
            right: toRem(-5);
        }
    }

    $size: toRem(48);
    $mobile-size: toRem(40);

    .left-nav-item {
        display: flex;
        align-items: center;
        gap: toRem(16);
        padding: toRem(8) toRem(16);
        cursor: pointer;

        @include mobile() {
            padding: toRem(6) toRem(10);
        }

        @media (hover: hover) {
            &:hover {
                background-color: var(--chatSummary-hv);
            }
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }

        &.separator {
            border-bottom: 1px solid var(--bd);
        }

        .icon {
            flex: 0 0 $size;
            width: $size;
            height: $size;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;

            @include mobile() {
                flex: 0 0 $mobile-size;
                width: $mobile-size;
                height: $mobile-size;
            }
        }

        .label {
            flex: auto;
            white-space: nowrap;
        }
    }
</style>
