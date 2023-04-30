<script lang="ts">
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import type { FullMember } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import { iconSize } from "../../../stores/iconSize";

    export let me: FullMember | undefined;
    export let publicGroup: boolean;
    export let closeIcon: "close" | "back";

    $: canAdd = !publicGroup && (me?.role === "admin" || me?.role === "owner");

    const dispatch = createEventDispatcher();
    function close() {
        dispatch("close");
    }

    function showInviteUsers() {
        dispatch("showInviteUsers");
    }
</script>

<SectionHeader gap border={false}>
    {#if canAdd}
        <span title={$_("group.inviteUsers")} class="add" on:click={showInviteUsers}>
            <HoverIcon>
                <AccountMultiplePlus size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    {/if}
    <h4>{$_("members")}</h4>
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

<style type="text/scss">
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
