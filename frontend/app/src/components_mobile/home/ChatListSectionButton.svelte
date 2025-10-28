<script lang="ts">
    import { CommonButton, NotificationIndicator } from "component-lib";
    import { emptyUnreadCounts, type ResourceKey, type UnreadCounts } from "openchat-client";
    import Translatable from "../Translatable.svelte";

    interface Props {
        selected?: boolean;
        title: ResourceKey;
        unread?: UnreadCounts;
        onClick?: (e: MouseEvent) => void;
    }

    let { selected = false, title, unread = emptyUnreadCounts(), onClick }: Props = $props();
    let muted = $derived(!unread.mentions && unread.unmuted <= 0);
    let count = $derived(muted ? unread.muted : unread.unmuted);
</script>

<CommonButton
    width={selected ? { kind: "share", value: 1.2 } : { kind: "share", value: 1 }}
    {onClick}
    mode={selected ? "active" : "default"}
    size={"small"}>
    <Translatable resourceKey={title}></Translatable>
    {#if count > 0}
        <div class="unread">
            <NotificationIndicator {muted}></NotificationIndicator>
        </div>
    {/if}
</CommonButton>

<style lang="scss">
    .unread {
        position: absolute;
        top: -2px;
        right: -2px;
    }
</style>
