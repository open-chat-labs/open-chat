<script lang="ts">
    import {
        type CommunitySummary,
        type Level,
        type MultiUserChat,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        closeIcon: "close" | "back";
        level: Level;
        container: MultiUserChat | CommunitySummary;
        isCommunityPublic: boolean;
        onCancelInviteUsers: () => void;
    }

    let { closeIcon, level, container, isCommunityPublic, onCancelInviteUsers }: Props = $props();

    let canAdd = $derived(
        !isCommunityPublic && container.kind === "channel" && client.canAddMembers(container.id),
    );
</script>

<SectionHeader border={false} flush>
    <h4>
        <Translatable
            resourceKey={canAdd
                ? i18nKey("group.addOrInviteUsers")
                : i18nKey("group.inviteUsers", undefined, level, true)} />
    </h4>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span title={$_("close")} class="close" onclick={onCancelInviteUsers}>
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
        padding: 0 $sp4;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
</style>
