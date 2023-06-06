<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import type { Level } from "openchat-client";
    import { interpolateLevel } from "../../../utils/i18n";

    export let canEdit: boolean;
    export let level: Level;

    const dispatch = createEventDispatcher();
    function close() {
        dispatch("close");
    }
    function showGroupMembers() {
        dispatch("showGroupMembers");
    }
    function editGroup() {
        if (canEdit) {
            dispatch("editGroup");
        }
    }
</script>

<SectionHeader border={false} flush={!$mobileWidth} shadow={true}>
    <span title={$_("members")} class="members" on:click={showGroupMembers}>
        <HoverIcon>
            <AccountMultiple size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    {#if canEdit}
        <span title={$_("group.edit")} class="edit" on:click={editGroup}>
            <HoverIcon>
                <PencilOutline size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    {/if}
    <h4>{interpolateLevel("groupDetails", level)}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
        @include font-size(fs-120);
    }
    .close,
    .members {
        flex: 0 0 30px;
    }
</style>
