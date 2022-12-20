<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import { AvatarSize, UserStatus } from "openchat-client";
    import Button from "../../Button.svelte";
    import { createEventDispatcher } from "svelte";
    import type { CandidateGroupChat } from "openchat-client";
    import { iconSize } from "../../../stores/iconSize";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import Rules from "../groupdetails/Rules.svelte";
    import GroupDetails from "./GroupDetails.svelte";
    import GroupVisibility from "./GroupVisibility.svelte";

    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    export let candidateGroup: CandidateGroupChat;
    export let busy: boolean;

    let groupInfoOpen = true;
    let visibilityOpen = true;
    let groupRulesOpen = true;
    let permissionsOpen = false;

    $: valid = candidateGroup.name.length > MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;

    function cancel() {
        dispatch("cancelNewGroup");
    }

    function createGroup() {
        dispatch("createGroup");
    }
</script>

<SectionHeader flush={true} shadow={true}>
    <Avatar url={"assets/group.svg"} status={UserStatus.None} size={AvatarSize.Tiny} />
    <h4>{$_("createNewGroup")}</h4>
    <span title={$_("close")} class="close" on:click={cancel}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<form class="group-form" on:submit|preventDefault={createGroup}>
    <div class="form-fields">
        <CollapsibleCard open={groupInfoOpen} headerText={$_("group.groupInfo")}>
            <GroupDetails bind:candidateGroup />
        </CollapsibleCard>
        <CollapsibleCard open={visibilityOpen} headerText={$_("group.visibility")}>
            <GroupVisibility bind:candidateGroup />
        </CollapsibleCard>
        <CollapsibleCard open={groupRulesOpen} headerText={$_("group.groupRules")}>
            <Rules bind:rules={candidateGroup.rules} />
        </CollapsibleCard>
        <CollapsibleCard open={permissionsOpen} headerText={$_("group.permissions.permissions")}>
            <GroupPermissionsEditor
                bind:permissions={candidateGroup.permissions}
                isPublic={candidateGroup.isPublic} />
        </CollapsibleCard>
    </div>
</form>
<div class="cta">
    <Button on:click={createGroup} fill={true} disabled={!valid || busy} loading={busy}
        >{$_("submitNewGroup")}</Button>
</div>

<style type="text/scss">
    :global(.group-form .form-fields .card) {
        margin-bottom: $sp3;
    }

    h4 {
        flex: 1;
        padding: 0 $sp4;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }

    .cta {
        position: sticky;
        bottom: 0;
        height: 57px;
    }

    .group-form {
        flex: 1;
        overflow: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
        padding: $sp3 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }
    }
</style>
