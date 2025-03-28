<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import type { Level } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { publish } from "@src/utils/pubsub";

    interface Props {
        canEdit: boolean;
        level: Level;
        onEditGroup: () => void;
        onClose: () => void;
    }

    let { canEdit, level, onEditGroup, onClose }: Props = $props();

    function showGroupMembers() {
        publish("showGroupMembers");
    }
    function editGroup() {
        if (canEdit) {
            onEditGroup();
        }
    }
</script>

<SectionHeader border={false} flush={!$mobileWidth} shadow>
    <span title={$_("members")} class="members" onclick={showGroupMembers}>
        <HoverIcon>
            <AccountMultiple size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    {#if canEdit}
        <span title={$_("group.edit", { values: { level } })} class="edit" onclick={editGroup}>
            <HoverIcon>
                <PencilOutline size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
    {/if}
    <h4><Translatable resourceKey={i18nKey("groupDetails", undefined, level)} /></h4>
    <span title={$_("close")} class="close" onclick={onClose}>
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
