<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import type { CommunitySummary, Level, MultiUserChat, OpenChat } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let closeIcon: "close" | "back";
    export let level: Level;
    export let container: MultiUserChat | CommunitySummary;
    export let isCommunityPublic: boolean;

    $: canAdd =
        !isCommunityPublic && container.kind === "channel" && client.canAddMembers(container.id);

    function cancelInviteUsers() {
        dispatch("cancelInviteUsers");
    }
</script>

<SectionHeader border={false} flush>
    <h4>
        <Translatable
            resourceKey={canAdd
                ? i18nKey("group.addOrInviteUsers")
                : i18nKey("group.inviteUsers", undefined, level, true)} />
    </h4>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <span title={$_("close")} class="close" on:click={cancelInviteUsers}>
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
