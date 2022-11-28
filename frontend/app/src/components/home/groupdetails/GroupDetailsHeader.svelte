<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";

    export let saving: boolean;

    const dispatch = createEventDispatcher();
    function close() {
        if (!saving) {
            dispatch("close");
        }
    }
    function showMembers() {
        if (!saving) {
            dispatch("showMembers");
        }
    }
</script>

<SectionHeader border={false} flush={!$mobileWidth} shadow={true}>
    <span title={$_("members")} class="members" on:click={showMembers}>
        <HoverIcon>
            <AccountMultiple size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <h4>{$_("groupDetails")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style type="text/scss">
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
