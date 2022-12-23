<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import { AvatarSize, UserStatus } from "openchat-client";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import Button from "../../Button.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { CandidateGroupChat, OpenChat } from "openchat-client";
    import { iconSize } from "../../../stores/iconSize";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import Rules from "../groupdetails/Rules.svelte";

    const client = getContext<OpenChat>("client");

    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

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

    function toggleScope() {
        candidateGroup.isPublic = !candidateGroup.isPublic;
        if (candidateGroup.isPublic) {
            candidateGroup.historyVisible = true;
        }
    }

    function groupAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidateGroup.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }
</script>

<SectionHeader flush={true} shadow={true}>
    <Avatar url={"assets/group.svg"} size={AvatarSize.Tiny} />
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
            <div class="sub-section photo">
                <EditableAvatar
                    image={client.groupAvatarUrl(candidateGroup.avatar)}
                    on:imageSelected={groupAvatarSelected} />
                <p class="photo-legend">{$_("group.addGroupPhoto")}</p>
            </div>
            <Input
                bind:value={candidateGroup.name}
                minlength={MIN_LENGTH}
                maxlength={MAX_LENGTH}
                countdown
                placeholder={$_("newGroupName")} />
            <TextArea
                rows={3}
                bind:value={candidateGroup.description}
                maxlength={MAX_DESC_LENGTH}
                placeholder={$_("newGroupDesc")} />
        </CollapsibleCard>
        <CollapsibleCard open={visibilityOpen} headerText={$_("group.visibility")}>
            <div class="sub-section">
                <div class="scope">
                    <span
                        class="scope-label"
                        class:selected={!candidateGroup.isPublic}
                        on:click={() => (candidateGroup.isPublic = false)}
                        >{$_("group.private")}</span>

                    <Checkbox
                        id="is-public"
                        toggle
                        on:change={toggleScope}
                        label={$_("group.public")}
                        checked={candidateGroup.isPublic} />

                    <span
                        class="scope-label"
                        class:selected={candidateGroup.isPublic}
                        on:click={() => (candidateGroup.isPublic = true)}
                        >{$_("group.public")}</span>
                </div>
                <div class="info">
                    {#if candidateGroup.isPublic}
                        <p>{$_("publicGroupInfo")}</p>
                        <p>{$_("publicGroupUnique")}</p>
                    {:else}
                        <p>{$_("privateGroupInfo")}</p>
                    {/if}
                </div>
            </div>
            <div class="sub-section">
                <div class="history">
                    <Checkbox
                        id="history-visible"
                        disabled={candidateGroup.isPublic}
                        on:change={() =>
                            (candidateGroup.historyVisible = !candidateGroup.historyVisible)}
                        label={$_("historyVisible")}
                        checked={candidateGroup.historyVisible} />
                </div>
                <div class="info">
                    {#if candidateGroup.historyVisible}
                        <p>{$_("historyOnInfo")}</p>
                    {:else}
                        <p>{$_("historyOffInfo")}</p>
                    {/if}
                </div>
            </div>
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

    .photo {
        text-align: center;
    }

    .photo-legend {
        margin-top: $sp4;
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

    .sub-section {
        padding: $sp4 0;
        // border: 1px solid var(--bd);
        // border-radius: $sp2;
        margin-bottom: $sp3;
        &:last-child {
            margin-bottom: 0;
        }
    }

    .scope {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp4;
    }

    .scope-label {
        @include font(book, normal, fs-140);
        cursor: pointer;
        border-bottom: 3px solid transparent;

        &.selected {
            border-bottom: 3px solid var(--button-bg);
        }
    }

    .info {
        @include font(light, normal, fs-90);

        p {
            margin-bottom: $sp4;
            &:last-child {
                margin-bottom: 0;
            }
        }
    }

    .history {
        margin-bottom: $sp4;
    }
</style>
