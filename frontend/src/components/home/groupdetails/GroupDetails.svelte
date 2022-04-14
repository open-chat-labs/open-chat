<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Avatar from "../../Avatar.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Stats from "../Stats.svelte";
    import { AvatarSize } from "../../../domain/user/user";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import { _ } from "svelte-i18n";
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { UpdatedGroup } from "../../../fsm/rightPanel";
    import type { GroupChatSummary, GroupPermissions } from "../../../domain/chat/chat";
    import { canChangePermissions, canEditGroupDetails } from "../../../domain/chat/chat.utils";
    import { createEventDispatcher } from "svelte";
    import type { ChatController } from "../../../fsm/chat.controller";
    import { userStore } from "../../../stores/user";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import Legend from "../../Legend.svelte";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";
    import Markdown from "../Markdown.svelte";
    import {
        groupInfoOpen,
        groupPermissionsOpen,
        groupStatsOpen,
        groupVisibilityOpen,
    } from "stores/settings";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;
    const dispatch = createEventDispatcher();

    export let controller: ChatController;
    export let updatedGroup: UpdatedGroup;
    export let originalGroup: GroupChatSummary;

    $: participants = controller.participants;

    let showConfirmation = false;
    let confirmed = false;
    let saving = false;
    let viewProfile = false;
    let myGroup = controller.user.userId === originalGroup.ownerId;

    $: nameDirty = updatedGroup.name !== originalGroup.name;
    $: descDirty = updatedGroup.desc !== originalGroup.description;
    $: avatarDirty = updatedGroup.avatar?.blobUrl !== originalGroup.blobUrl;
    $: permissionsDirty = havePermissionsChanged(
        originalGroup.permissions,
        updatedGroup.permissions
    );
    $: dirty = nameDirty || descDirty || avatarDirty || permissionsDirty;
    $: canEdit = canEditGroupDetails(originalGroup);
    $: canEditPermissions = canChangePermissions(originalGroup);
    $: avatarSrc = avatarUrl(updatedGroup.avatar, "../assets/group.svg");

    function openUserProfile() {
        if (!myGroup) {
            viewProfile = true;
        }
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function havePermissionsChanged(p1: GroupPermissions, p2: GroupPermissions): boolean {
        return (
            p1.changePermissions !== p2.changePermissions ||
            p1.changeRoles !== p2.changeRoles ||
            p1.addMembers !== p2.addMembers ||
            p1.removeMembers !== p2.removeMembers ||
            p1.blockUsers !== p2.blockUsers ||
            p1.deleteMessages !== p2.deleteMessages ||
            p1.updateGroup !== p2.updateGroup ||
            p1.pinMessages !== p2.pinMessages ||
            p1.createPolls !== p2.createPolls ||
            p1.sendMessages !== p2.sendMessages ||
            p1.reactToMessages !== p2.reactToMessages
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
                        ...originalGroup,
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

    function chatWithOwner() {
        if (!myGroup) {
            closeUserProfile();
            dispatch("chatWith", originalGroup.ownerId);
            dispatch("close");
        }
    }
</script>

{#if viewProfile}
    <ViewUserProfile
        userId={originalGroup.ownerId}
        on:openDirectChat={chatWithOwner}
        on:close={closeUserProfile} />
{/if}

<GroupDetailsHeader {saving} on:showParticipants={showParticipants} on:close={close} />

<form class="group-form" on:submit|preventDefault={updateGroup}>
    <div class="form-fields">
        <CollapsibleCard
            on:toggle={groupInfoOpen.toggle}
            open={$groupInfoOpen}
            headerText={$_("group.groupInfo")}>
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

                {#if !canEdit}
                    <h3>{originalGroup.name}</h3>
                    <p class="members">
                        {$_("memberCount", { values: { count: $participants.length } })}
                    </p>
                    <p class="owned-by" on:click={openUserProfile} class:my-group={myGroup}>
                        {$_("ownedBy", {
                            values: {
                                username: $userStore[originalGroup.ownerId]?.username ?? "uknown",
                            },
                        })}
                    </p>
                {/if}
            </div>

            {#if canEdit}
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
            {:else if originalGroup.description !== ""}
                <fieldset>
                    <legend>
                        <Legend>{$_("groupDesc")}</Legend>
                    </legend>
                    <Markdown text={originalGroup.description} />
                </fieldset>
            {/if}
        </CollapsibleCard>
        <CollapsibleCard
            on:toggle={groupVisibilityOpen.toggle}
            open={$groupVisibilityOpen}
            headerText={$_("group.visibility")}>
            {#if originalGroup.public}
                <h4>{$_("group.publicGroup")}</h4>
            {:else}
                <h4>{$_("group.privateGroup")}</h4>
            {/if}

            <div class="info">
                {#if originalGroup.public}
                    <p>{$_("publicGroupInfo")}</p>
                    <p>{$_("publicGroupUnique")}</p>
                {:else}
                    <p>{$_("privateGroupInfo")}</p>
                {/if}
            </div>
        </CollapsibleCard>
        <CollapsibleCard
            on:toggle={groupPermissionsOpen.toggle}
            open={$groupPermissionsOpen}
            headerText={$_("group.permissions.permissions")}>
            {#if canEditPermissions}
                <GroupPermissionsEditor
                    bind:permissions={updatedGroup.permissions}
                    isPublic={originalGroup.public} />
            {:else}
                <GroupPermissionsViewer
                    bind:permissions={updatedGroup.permissions}
                    isPublic={originalGroup.public} />
            {/if}
        </CollapsibleCard>
        <CollapsibleCard
            on:toggle={groupStatsOpen.toggle}
            open={$groupStatsOpen}
            headerText={$_("stats.groupStats")}>
            <Stats stats={originalGroup.metrics} />
        </CollapsibleCard>
    </div>
</form>

{#if canEdit || canEditPermissions}
    <div class="cta">
        <Button
            on:click={updateGroup}
            disabled={(permissionsDirty && !canEditPermissions) ||
                (!permissionsDirty && dirty && !canEdit) ||
                !dirty ||
                saving}
            fill={true}
            loading={saving}>{$_("update")}</Button>
    </div>
{/if}

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

    fieldset {
        border: 1px solid var(--input-bd);
        border-radius: $sp2;
        padding: $sp3;
        @include font(light, normal, fs-100);
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
        padding: $sp3;
        padding-bottom: 0;
        @include mobile() {
            padding: 0 $sp3;
        }
    }

    h4,
    h3 {
        margin-bottom: $sp3;
    }

    h3 {
        @include font(bold, normal, fs-120);
    }

    .members {
        @include font(light, normal, fs-90);
    }

    .owned-by {
        @include font(book, normal, fs-90);
        cursor: pointer;

        &.my-group {
            cursor: auto;
        }
    }

    .sub-section {
        padding: $sp4;
        // background-color: var(--sub-section-bg);
        margin-bottom: $sp3;
        border: 1px solid var(--input-bd);
        border-radius: $sp2;
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
