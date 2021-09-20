<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import type { EditGroupMachine } from "../../../fsm/editgroup.machine";
    import { _ } from "svelte-i18n";

    export let machine: ActorRefFrom<EditGroupMachine>;

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;
    let groupAvatar: string | undefined = undefined;

    let groupName = $machine.context.editedChatSummary.name;
    let groupDesc = $machine.context.editedChatSummary.description;
    let isPublic = $machine.context.editedChatSummary.public;
    let showConfirmation = false;
    let confirmed = false;

    $: dirty =
        groupName !== $machine.context.chatSummary.name ||
        groupDesc !== $machine.context.chatSummary.description;

    $: saving = $machine.matches({ group_details: "saving_group" });

    function close() {
        if (dirty && !confirmed) {
            confirmed = true;
            showConfirmation = true;
        } else {
            showConfirmation = false;
            machine.send({ type: "CLOSE_GROUP_DETAILS" });
        }
    }

    function showParticipants() {
        machine.send({ type: "SYNC_CHAT_DETAILS", data: { name: groupName, desc: groupDesc } });
        machine.send({ type: "SHOW_PARTICIPANTS" });
    }

    function groupAvatarSelected(ev: CustomEvent<string>) {
        groupAvatar = ev.detail;
    }

    function updateGroup() {
        machine.send({ type: "SAVE_GROUP_DETAILS", data: { name: groupName, desc: groupDesc } });
    }
</script>

<GroupDetailsHeader on:showParticipants={showParticipants} on:close={close} />

<form class="group-form" on:submit|preventDefault={updateGroup}>
    <div class="form-fields">
        <div class="sub-section photo">
            <EditableAvatar image={groupAvatar} on:imageSelected={groupAvatarSelected} />
            <p class="photo-legend">{$_("addGroupPhoto")}</p>
        </div>

        <Input
            invalid={false}
            autofocus={false}
            bind:value={groupName}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("newGroupName")} />

        <TextArea
            bind:value={groupDesc}
            invalid={false}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("newGroupDesc")} />

        <div class="sub-section">
            {#if isPublic}
                <h4>{$_("publicGroup")}</h4>
            {:else}
                <h4>{$_("privateGroup")}</h4>
            {/if}

            <div class="info">
                {#if isPublic}
                    <p>
                        {$_("publicGroupInfo")}
                    </p>
                    <p>
                        {$_("publicGroupUnique")}
                    </p>
                {:else}
                    <p>
                        {$_("privateGroupInfo")}
                    </p>
                {/if}
            </div>
        </div>
    </div>
    <div class="cta">
        <Button loading={saving} disabled={!dirty} fill={true}>{$_("update")}</Button>
    </div>
</form>

<Overlay active={showConfirmation}>
    <ModalContent fill={true}>
        <span slot="header">{$_("areYouSure")}</span>
        <span slot="body">
            <p class="unsaved">
                {$_("unsavedGroupChanges")}
            </p>
        </span>
        <span slot="footer">
            <Button small={true} on:click={updateGroup}>{$_("save")}</Button>
            <Button small={true} on:click={close} secondary={true}>{$_("discard")}</Button>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .unsaved {
        padding: $sp5;
    }

    .photo {
        text-align: center;
    }

    .photo-legend {
        margin-top: $sp4;
    }

    .cta {
        position: absolute;
        bottom: 0;
        height: 57px;
        width: 100%;
    }

    .group-form {
        flex: 1;
        background-color: var(--section-bg);
        color: var(--section-txt);
        overflow: auto;
        @include size-below(xs) {
            background-color: transparent;
        }
    }

    .form-fields {
        padding: $sp4;
        @include size-below(xs) {
            padding: $sp3;
        }
    }

    .sub-section {
        padding: $sp4;
        background-color: var(--sub-section-bg);
        margin-bottom: $sp4;
        @include box-shadow(1);

        h4 {
            margin-bottom: $sp4;
        }
    }

    .info {
        @include font(light, normal, fs-90);

        p {
            margin-bottom: $sp4;
        }
    }
</style>
