<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import { _ } from "svelte-i18n";
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { UpdatedGroup } from "../../../fsm/editGroup";
    import type { GroupChatSummary, UpdateGroupResponse } from "../../../domain/chat/chat";
    import { createEventDispatcher } from "svelte";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import { toastStore } from "../../../stores/toast";
    import { rollbar } from "../../../utils/logging";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;
    const dispatch = createEventDispatcher();

    export let updatedGroup: UpdatedGroup;
    export let chat: GroupChatSummary;
    export let userId: string;
    export let api: ServiceContainer;

    let showConfirmation = false;
    let confirmed = false;
    let saving = false;

    $: nameDirty = updatedGroup.name !== chat.name;
    $: descDirty = updatedGroup.desc !== chat.description;
    $: avatarDirty = updatedGroup.avatar?.blobUrl !== chat.blobUrl;
    $: dirty = nameDirty || descDirty || avatarDirty;

    $: canEdit = chat.participants.find((p) => p.userId === userId)?.role === "admin";

    function close() {
        if (dirty && !confirmed) {
            confirmed = true;
            showConfirmation = true;
        } else {
            showConfirmation = false;
            dispatch("close");
        }
    }

    function showParticipants() {
        dispatch("showParticipants");
    }

    function groupAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        updatedGroup.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function updateGroup() {
        saving = true;
        api.updateGroup(
            chat.chatId,
            updatedGroup.name,
            updatedGroup.desc,
            updatedGroup.avatar?.blobData
        )
            .then((resp) => {
                const err = groupUpdateErrorMessage(resp);
                if (err) {
                    toastStore.showFailureToast(err);
                } else {
                    chat.name = updatedGroup.name;
                    chat.description = updatedGroup.desc;
                    chat.blobUrl = updatedGroup.avatar?.blobUrl;
                    dispatch("close");
                }
            })
            .catch((err) => {
                rollbar.error("Update group failed: ", err);
                toastStore.showFailureToast("groupUpdateFailed");
            })
            .finally(() => (showConfirmation = saving = false));
    }

    function groupUpdateErrorMessage(resp: UpdateGroupResponse): string | undefined {
        if (resp === "success") return undefined;
        if (resp === "unchanged") return undefined;
        if (resp === "desc_too_long") return "groupDescTooLong";
        if (resp === "internal_error") return "groupUpdateFailed";
        if (resp === "not_authorised") return "groupUpdateFailed";
        if (resp === "name_too_long") return "groupNameTooLong";
        if (resp === "name_taken") return "groupAlreadyExists";
    }
</script>

<GroupDetailsHeader {saving} on:showParticipants={showParticipants} on:close={close} />

<form class="group-form" on:submit|preventDefault={updateGroup}>
    <div class="form-fields">
        <div class="sub-section photo">
            <EditableAvatar
                disabled={saving}
                image={avatarUrl(updatedGroup.avatar, "../assets/group.svg")}
                on:imageSelected={groupAvatarSelected} />
            <p class="photo-legend">{$_("addGroupPhoto")}</p>
        </div>

        <Input
            invalid={false}
            disabled={saving || !canEdit}
            autofocus={false}
            bind:value={updatedGroup.name}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("newGroupName")} />

        <TextArea
            disabled={saving || !canEdit}
            bind:value={updatedGroup.desc}
            invalid={false}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("newGroupDesc")} />

        <div class="sub-section">
            {#if chat.public}
                <h4>{$_("publicGroup")}</h4>
            {:else}
                <h4>{$_("privateGroup")}</h4>
            {/if}

            <div class="info">
                {#if chat.public}
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
