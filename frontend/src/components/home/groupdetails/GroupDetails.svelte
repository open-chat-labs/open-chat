<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Avatar from "../../Avatar.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import { _ } from "svelte-i18n";
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { UpdatedGroup } from "../../../fsm/rightPanel";
    import type { GroupChatSummary, GroupPermissions } from "../../../domain/chat/chat";
    import { createEventDispatcher } from "svelte";
    import type { Readable } from "svelte/store";
    import type { ChatController } from "../../../fsm/chat.controller";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;
    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let updatedGroup: UpdatedGroup;

    $: chat = controller.chat as Readable<GroupChatSummary>;

    let showConfirmation = false;
    let confirmed = false;
    let saving = false;
    let groupInfoOpen = true;
    let visibilityOpen = true;
    let permissionsOpen = false;

    $: nameDirty = updatedGroup.name !== $chat.name;
    $: descDirty = updatedGroup.desc !== $chat.description;
    $: avatarDirty = updatedGroup.avatar?.blobUrl !== $chat.blobUrl;
    $: permissionsDirty = havePermissionsChanged($chat.permissions, updatedGroup.permissions);
    $: dirty = nameDirty || descDirty || avatarDirty || permissionsDirty;
    $: canEdit = $chat.myRole === "admin" || $chat.myRole === "owner";
    $: avatarSrc = avatarUrl(updatedGroup.avatar, "../assets/group.svg");

    function havePermissionsChanged(p1: GroupPermissions, p2: GroupPermissions): boolean {
        return (
            p1.changePermissions != p2.changePermissions ||
            p1.changeRoles != p2.changeRoles ||
            p1.addMembers != p2.addMembers ||
            p1.removeMembers != p2.removeMembers ||
            p1.blockUsers != p2.blockUsers ||
            p1.deleteMessages != p2.deleteMessages ||
            p1.updateGroup != p2.updateGroup ||
            p1.pinMessages != p2.pinMessages ||
            p1.createPolls != p2.createPolls ||
            p1.sendMessages != p2.sendMessages ||
            p1.reactToMessages != p2.reactToMessages
        );
    }

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

        controller
            .updateGroup(
                updatedGroup.name,
                updatedGroup.desc,
                updatedGroup.avatar?.blobData,
                permissionsDirty ? updatedGroup.permissions : undefined
            )
            .then((success) => {
                if (success) {
                    dispatch("updateChat", {
                        ...$chat,
                        name: updatedGroup.name,
                        description: updatedGroup.desc,
                        blobUrl: updatedGroup.avatar?.blobUrl,
                        permissions: updatedGroup.permissions,
                    });
                    dispatch("close");
                }
            })
            .finally(() => (showConfirmation = saving = false));
    }
</script>

<GroupDetailsHeader {saving} on:showParticipants={showParticipants} on:close={close} />

<form class="group-form" on:submit|preventDefault={updateGroup}>
    <div class="form-fields">
        <CollapsibleCard open={groupInfoOpen} headerText={$_("group.groupInfo")}>
            <div class="sub-section photo">
                {#if canEdit}
                    <EditableAvatar
                        disabled={saving}
                        image={avatarSrc}
                        on:imageSelected={groupAvatarSelected} />
                    <p class="photo-legend">{$_("group.addGroupPhoto")}</p>
                {:else}
                    <Avatar url={avatarSrc} size={AvatarSize.ExtraLarge} />
                {/if}
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
        </CollapsibleCard>
        <CollapsibleCard open={visibilityOpen} headerText={$_("group.visibility")}>
            <div class="sub-section">
                {#if $chat.public}
                    <h4>{$_("group.publicGroup")}</h4>
                {:else}
                    <h4>{$_("group.privateGroup")}</h4>
                {/if}

                <div class="info">
                    {#if $chat.public}
                        <p>{$_("publicGroupInfo")}</p>
                        <p>{$_("publicGroupUnique")}</p>
                    {:else}
                        <p>{$_("privateGroupInfo")}</p>
                    {/if}
                </div>
            </div>
        </CollapsibleCard>
        <CollapsibleCard open={permissionsOpen} headerText={$_("group.permissions.permissions")}>
            <GroupPermissionsEditor
                bind:permissions={updatedGroup.permissions}
                isPublic={$chat.public}
                viewMode={!canEdit} />
        </CollapsibleCard>
    </div>
</form>
<div class="cta">
    <Button
        on:click={updateGroup}
        disabled={!dirty || saving || !canEdit}
        fill={true}
        loading={saving}>{$_("update")}</Button>
</div>

<Overlay bind:active={showConfirmation}>
    <ModalContent fill={true}>
        <span slot="header">{$_("areYouSure")}</span>
        <span slot="body">
            <p class="unsaved">
                {$_("unsavedGroupChanges")}
            </p>
        </span>
        <span slot="footer" class="footer">
            <ButtonGroup>
                <Button loading={saving} disabled={saving} small={true} on:click={updateGroup}
                    >{$_("save")}</Button>
                <Button disabled={saving} small={true} on:click={close} secondary={true}
                    >{$_("discard")}</Button>
            </ButtonGroup>
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
        position: sticky;
        bottom: 0;
        height: 57px;
        width: 100%;
    }

    .group-form {
        flex: 1;
        color: var(--section-txt);
        overflow: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
        background-color: transparent;
    }

    .form-fields {
        padding: var(--groupForm-edit-pd);
        padding-bottom: 0;
        @include size-below(xs) {
            padding: 0 $sp3;
        }
    }

    .sub-section {
        padding: $sp4;
        background-color: var(--sub-section-bg);
        margin-bottom: $sp3;

        &:last-child {
            margin-bottom: 0;
        }

        @include box-shadow(1);

        h4 {
            margin-bottom: $sp4;
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
</style>
