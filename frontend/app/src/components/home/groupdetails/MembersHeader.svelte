<script lang="ts">
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import type { Level } from "openchat-client";
    import { interpolateLevel } from "utils/i18n";

    export let closeIcon: "close" | "back";
    export let canInvite: boolean;
    export let level: Level;

    const dispatch = createEventDispatcher();
    function close() {
        dispatch("close");
    }

    function showInviteUsers() {
        dispatch("showInviteUsers");
    }
</script>

<SectionHeader gap border={false}>
    {#if canInvite}
        <span
            title={interpolateLevel("group.inviteUsers", level, true)}
            class="add"
            on:click={showInviteUsers}>
            <HoverIcon>
                <AccountMultiplePlus size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    {/if}
    <h4>{interpolateLevel("membersHeader", level)}</h4>
    <span title={$_("close")} class="close" on:click={close}>
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
