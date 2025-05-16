<script lang="ts">
    import { iconSize, type Level, type ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        closeIcon: "close" | "back";
        canInvite: boolean;
        level: Level;
        title?: ResourceKey | undefined;
        onClose: () => void;
        onShowInviteUsers: () => void;
    }

    let {
        closeIcon,
        canInvite,
        level,
        title = undefined,
        onClose,
        onShowInviteUsers,
    }: Props = $props();

    let titleKey = $derived(title ?? i18nKey("membersHeader", undefined, level));
</script>

<SectionHeader gap border={false}>
    {#if canInvite}
        <span
            title={interpolate($_, i18nKey("group.inviteUsers", undefined, level, true))}
            class="add"
            onclick={onShowInviteUsers}>
            <HoverIcon>
                <AccountMultiplePlus size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    {/if}
    <h4><Translatable resourceKey={titleKey} /></h4>
    <span title={$_("close")} class="close" onclick={onClose}>
        <HoverIcon>
            {#if closeIcon === "close"}
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </span>
</SectionHeader>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0;
        @include font-size(fs-120);
    }
    .close,
    .add {
        flex: 0 0 30px;
    }
</style>
