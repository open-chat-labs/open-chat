<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import type { EditGroupMachine, UpdatedAvatar } from "../../../fsm/editgroup.machine";
    import { _ } from "svelte-i18n";
    import { avatarUrl } from "../../../domain/user/user.utils";

    export let machine: ActorRefFrom<EditGroupMachine>;

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    let groupAvatar: UpdatedAvatar | undefined = $machine.context.updatedGroup.avatar
        ? $machine.context.updatedGroup.avatar
        : $machine.context.chatSummary.blobUrl
        ? {
              blobUrl: $machine.context.chatSummary.blobUrl,
              blobData: $machine.context.chatSummary.blobData,
          }
        : undefined;

    let groupName = $machine.context.updatedGroup.name;
    let groupDesc = $machine.context.updatedGroup.desc;
    let isPublic = $machine.context.chatSummary.public;
    let showConfirmation = false;
    let confirmed = false;

    $: nameDirty = groupName !== $machine.context.chatSummary.name;
    $: descDirty = groupDesc !== $machine.context.chatSummary.description;
    $: avatarDirty = groupAvatar?.blobUrl !== $machine.context.chatSummary.blobUrl;
    $: dirty = nameDirty || descDirty || avatarDirty;
    $: saving = $machine.matches({ group_details: "saving_group" });

    $: updatedGroup = {
        name: nameDirty ? groupName : $machine.context.chatSummary.name,
        desc: descDirty ? groupDesc : $machine.context.chatSummary.description,
        avatar: avatarDirty ? groupAvatar : undefined,
    };

    $: canEdit =
        $machine.context.chatSummary.participants.find(
            (p) => p.userId === $machine.context.user?.userId
        )?.role === "admin";

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
        machine.send({ type: "SYNC_CHAT_DETAILS", data: updatedGroup });
        machine.send({ type: "SHOW_PARTICIPANTS" });
    }

    function groupAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        groupAvatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function updateGroup() {
        machine.send({ type: "SAVE_GROUP_DETAILS", data: updatedGroup });
    }
</script>

<GroupDetailsHeader {saving} on:showParticipants={showParticipants} on:close={close} />

<form class="group-form" on:submit|preventDefault={updateGroup}>
    <div class="form-fields">
        <div class="sub-section photo">
            <EditableAvatar
                disabled={saving}
                image={avatarUrl(groupAvatar, "../assets/group.svg")}
                on:imageSelected={groupAvatarSelected} />
            <p class="photo-legend">{$_("addGroupPhoto")}</p>
        </div>

        <Input
            invalid={false}
            disabled={saving || !canEdit}
            autofocus={false}
            bind:value={groupName}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("newGroupName")} />

        <TextArea
            disabled={saving || !canEdit}
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
        <Button loading={saving} disabled={!dirty || saving || !canEdit} fill={true}
            >{$_("update")}</Button>
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
            <div class="buttons">
                <Button loading={saving} disabled={saving} small={true} on:click={updateGroup}
                    >{$_("save")}</Button>
                <Button disabled={saving} small={true} on:click={close} secondary={true}
                    >{$_("discard")}</Button>
            </div>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    :global(.buttons button) {
        margin-right: $sp3;
    }

    .unsaved {
        padding: $sp5;
    }

    .buttons {
        display: flex;
        justify-content: flex-end;
        align-items: center;
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
        color: var(--section-txt);
        overflow: auto;
        background-color: transparent;
    }

    .form-fields {
        padding: $sp4;
        @include size-below(xs) {
            padding: 0 $sp3;
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
