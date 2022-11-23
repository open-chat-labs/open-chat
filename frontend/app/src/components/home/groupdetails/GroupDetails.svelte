<script lang="ts">
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Avatar from "../../Avatar.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Stats from "../Stats.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import GroupPermissionsViewer from "../GroupPermissionsViewer.svelte";
    import Legend from "../../Legend.svelte";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";
    import Markdown from "../Markdown.svelte";
    import {
        groupAdvancedOpen,
        groupInfoOpen,
        groupInviteUsersOpen,
        groupPermissionsOpen,
        groupRulesOpen,
        groupStatsOpen,
        groupVisibilityOpen,
    } from "../../../stores/settings";
    import AdvancedSection from "./AdvancedSection.svelte";
    import InviteUsers from "./InviteUsers.svelte";
    import { toastStore } from "../../../stores/toast";
    import { logger } from "../../../utils/logging";
    import Rules from "./Rules.svelte";
    import type {
        OpenChat,
        GroupChatSummary,
        GroupPermissions,
        GroupRules,
        UpdateGroupResponse,
    } from "openchat-client";
    import { AvatarSize, UnsupportedValueError } from "openchat-client";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;
    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    export let chat: GroupChatSummary;
    export let memberCount: number;
    export let rules: GroupRules | undefined;

    let originalGroup = { ...chat };
    let updatedGroup = {
        chatId: chat.chatId,
        name: chat.name,
        desc: chat.description,
        avatar: chat.blobUrl
            ? {
                  blobUrl: chat.blobUrl,
                  blobData: chat.blobData,
              }
            : undefined,
        permissions: { ...chat.permissions },
    };

    let updatedRules: GroupRules | undefined = undefined;

    $: userStore = client.userStore;
    $: {
        if (updatedGroup.chatId !== chat.chatId) {
            switchChat();
        }
    }

    $: {
        if (rules !== undefined && updatedRules === undefined) {
            updatedRules = { ...rules };
        }
    }

    function init() {
        confirmed = false;
        updatedGroup = {
            chatId: chat.chatId,
            name: chat.name,
            desc: chat.description,
            avatar: chat.blobUrl
                ? {
                      blobUrl: chat.blobUrl,
                      blobData: chat.blobData,
                  }
                : undefined,
            permissions: { ...chat.permissions },
        };
        originalGroup = { ...chat };
        updatedRules = undefined;
        if (canInvite) {
            inviteComponent?.init(originalGroup);
        }
    }

    let showConfirmation = false;
    let confirmed = false;
    let saving = false;
    let viewProfile = false;
    let postConfirmation = () => {
        dispatch("close");
    };
    let inviteComponent: InviteUsers;

    // capture a snapshot of the chat as it is right now
    $: myGroup = currentUser.userId === originalGroup.ownerId;
    $: nameDirty = updatedGroup.name !== originalGroup.name;
    $: descDirty = updatedGroup.desc !== originalGroup.description;
    $: rulesDirty =
        updatedRules !== undefined &&
        rules !== undefined &&
        (updatedRules.enabled !== rules.enabled || updatedRules.text !== rules.text);
    $: rulesInvalid =
        updatedRules !== undefined && updatedRules.enabled && updatedRules.text.length === 0;
    $: avatarDirty = updatedGroup.avatar?.blobUrl !== originalGroup.blobUrl;
    $: permissionsDirty = havePermissionsChanged(
        originalGroup.permissions,
        updatedGroup.permissions
    );
    $: infoDirty = nameDirty || descDirty || avatarDirty;
    $: dirty = infoDirty || rulesDirty || permissionsDirty;
    $: canEdit = client.canEditGroupDetails(originalGroup.chatId);
    $: canEditPermissions = client.canChangePermissions(originalGroup.chatId);
    $: canInvite = client.canInviteUsers(originalGroup.chatId);
    $: avatarSrc = client.groupAvatarUrl(updatedGroup.avatar);

    function openUserProfile() {
        if (!myGroup) {
            viewProfile = true;
        }
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function havePermissionsChanged(p1: GroupPermissions, p2: GroupPermissions): boolean {
        const args = client.mergeKeepingOnlyChanged(p1, p2);
        return Object.keys(args).length > 0;
    }

    function clickClose() {
        postConfirmation = () => {
            dispatch("close");
        };
        close();
    }

    function switchChat() {
        if (showConfirmation) {
            return;
        }

        // check for unsaved changes
        if (dirty && !confirmed) {
            confirmed = true;
            showConfirmation = true;
            postConfirmation = init;
        } else {
            init();
        }
    }

    function close() {
        if (dirty && !confirmed) {
            confirmed = true;
            showConfirmation = true;
        } else {
            showConfirmation = false;
            postConfirmation();
        }
    }

    function showMembers() {
        dispatch("showMembers");
    }

    function groupAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        updatedGroup.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function updateGroup() {
        saving = true;

        const p1 = infoDirty ? doUpdateInfo() : Promise.resolve();
        const p2 = permissionsDirty ? doUpdatePermissions() : Promise.resolve();
        const p3 = rulesDirty && !rulesInvalid ? doUpdateRules() : Promise.resolve();

        Promise.all([p1, p2, p3]).finally(() => {
            showConfirmation = false;
            saving = false;
            postConfirmation();
        });
    }

    function updateInfo() {
        if (!infoDirty) return;
        saving = true;
        doUpdateInfo().finally(() => {
            saving = false;
        });
    }

    function updateRules() {
        if (!rulesDirty || rulesInvalid) return;
        saving = true;
        doUpdateRules().finally(() => {
            saving = false;
        });
    }

    function groupUpdateErrorMessage(resp: UpdateGroupResponse): string | undefined {
        if (resp === "success") return undefined;
        if (resp === "unchanged") return undefined;
        if (resp === "name_too_short") return "groupNameTooShort";
        if (resp === "name_too_long") return "groupNameTooLong";
        if (resp === "name_reserved") return "groupNameReserved";
        if (resp === "desc_too_long") return "groupDescTooLong";
        if (resp === "name_taken") return "groupAlreadyExists";
        if (resp === "not_in_group") return "userNotInGroup";
        if (resp === "internal_error") return "groupUpdateFailed";
        if (resp === "not_authorised") return "groupUpdateFailed";
        if (resp === "avatar_too_big") return "avatarTooBig";
        if (resp === "rules_too_short") return "groupRulesTooShort";
        if (resp === "rules_too_long") return "groupRulesTooLong";
        throw new UnsupportedValueError(`Unexpected UpdateGroupResponse type received`, resp);
    }

    function doUpdateInfo(): Promise<void> {
        return client
            .updateGroup(
                updatedGroup.chatId,
                nameDirty ? updatedGroup.name : undefined,
                descDirty ? updatedGroup.desc : undefined,
                undefined,
                undefined,
                avatarDirty ? updatedGroup.avatar?.blobData : undefined
            )
            .then((resp) => {
                const err = groupUpdateErrorMessage(resp);
                if (err) {
                    toastStore.showFailureToast(err);
                } else {
                    originalGroup = {
                        ...originalGroup,
                        ...updatedGroup.avatar,
                        name: updatedGroup.name,
                        description: updatedGroup.desc,
                    };
                }
            })
            .catch((err) => {
                logger.error("Update group failed: ", err);
                toastStore.showFailureToast("groupUpdateFailed");
            });
    }

    function doUpdateRules(): Promise<void> {
        return client.updateGroupRules(updatedGroup.chatId, updatedRules).then((success) => {
            if (success) {
                dispatch("updateGroupRules", {
                    chatId: updatedGroup.chatId,
                    rules: updatedRules,
                });
            } else {
                toastStore.showFailureToast("group.rulesUpdateFailed");
            }
        });
    }

    function updatePermissions() {
        if (!permissionsDirty) return;

        saving = true;

        doUpdatePermissions().finally(() => {
            saving = false;
        });
    }

    function doUpdatePermissions(): Promise<void> {
        return client
            .updateGroupPermissions(
                updatedGroup.chatId,
                originalGroup.permissions,
                updatedGroup.permissions
            )
            .then((success) => {
                if (success) {
                    originalGroup = {
                        ...originalGroup,
                        permissions: { ...updatedGroup.permissions },
                    };
                } else {
                    toastStore.showFailureToast("group.permissionsUpdateFailed");
                }
            });
    }

    function chatWithOwner() {
        if (!myGroup) {
            closeUserProfile();
            dispatch("chatWith", originalGroup.ownerId);
            dispatch("close");
        }
    }

    function description(): string {
        let description = originalGroup.description;

        if (originalGroup.subtype?.kind === "governance_proposals" ?? false) {
            description = description.replace("{userId}", currentUser.userId);
        }

        return description;
    }
</script>

{#if viewProfile}
    <ViewUserProfile
        userId={originalGroup.ownerId}
        on:openDirectChat={chatWithOwner}
        on:close={closeUserProfile} />
{/if}

<GroupDetailsHeader {saving} on:showMembers={showMembers} on:close={clickClose} />

<div class="group-details">
    <div class="inner">
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

                    <h3 class="group-name">{originalGroup.name}</h3>
                    <p class="members">
                        {$_("memberCount", { values: { count: memberCount } })}
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
                    disabled={saving || !canEdit}
                    bind:value={updatedGroup.name}
                    minlength={MIN_LENGTH}
                    maxlength={MAX_LENGTH}
                    countdown
                    placeholder={$_("newGroupName")} />

                <TextArea
                    disabled={saving || !canEdit}
                    bind:value={updatedGroup.desc}
                    invalid={false}
                    maxlength={MAX_DESC_LENGTH}
                    placeholder={$_("newGroupDesc")} />

                <Button
                    on:click={updateInfo}
                    fill
                    disabled={!canEdit || !infoDirty || saving}
                    loading={saving}>{$_("update")}</Button>
            {:else if originalGroup.description?.length > 0}
                <fieldset>
                    <legend>
                        <Legend>{$_("groupDesc")}</Legend>
                    </legend>
                    <Markdown text={description()} />
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
                {:else}
                    <p>{$_("group.privateGroupInfo")}</p>
                {/if}
                {#if !originalGroup.public}
                    {#if originalGroup.historyVisibleToNewJoiners}
                        <p>{$_("historyOnInfo")}</p>
                    {:else}
                        <p>{$_("historyOffInfo")}</p>
                    {/if}
                {/if}
            </div>
        </CollapsibleCard>
        {#if rules !== undefined && (canEdit || rules.enabled)}
            <CollapsibleCard
                on:toggle={groupRulesOpen.toggle}
                open={$groupRulesOpen}
                headerText={$_("group.groupRules")}>
                {#if canEdit && updatedRules !== undefined}
                    <Rules bind:rules={updatedRules} />
                    <div class="rules-button">
                        <Button
                            on:click={updateRules}
                            fill
                            disabled={!canEdit || !rulesDirty || saving || rulesInvalid}
                            loading={saving}>{$_("update")}</Button>
                    </div>
                {:else if !canEdit && rules.enabled}
                    <Markdown inline={false} text={rules.text} />
                {/if}
            </CollapsibleCard>
        {/if}
        {#if canInvite}
            <CollapsibleCard
                on:toggle={groupInviteUsersOpen.toggle}
                open={$groupInviteUsersOpen}
                headerText={$_("group.invite.inviteWithLink")}>
                <InviteUsers bind:this={inviteComponent} group={originalGroup} />
            </CollapsibleCard>
        {/if}
        <CollapsibleCard
            on:toggle={groupPermissionsOpen.toggle}
            open={$groupPermissionsOpen}
            headerText={$_("group.permissions.permissions")}>
            {#if canEditPermissions}
                <GroupPermissionsEditor
                    bind:permissions={updatedGroup.permissions}
                    isPublic={originalGroup.public} />

                {#if canEditPermissions}
                    <div class="update-permissions">
                        <Button
                            on:click={updatePermissions}
                            fill
                            disabled={!canEditPermissions || !permissionsDirty || saving}
                            loading={saving}>{$_("update")}</Button>
                    </div>
                {/if}
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
        {#if client.canDeleteGroup(originalGroup.chatId)}
            <CollapsibleCard
                on:toggle={groupAdvancedOpen.toggle}
                open={$groupAdvancedOpen}
                headerText={$_("group.advanced")}>
                <AdvancedSection
                    on:deleteGroup
                    on:makeGroupPrivate
                    group={originalGroup}
                    canMakeGroupPrivate={client.canMakeGroupPrivate(originalGroup.chatId)} />
            </CollapsibleCard>
        {/if}
    </div>
</div>

{#if showConfirmation}
    <Overlay>
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
{/if}

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

    fieldset {
        border: 1px solid var(--bd);
        border-radius: $sp2;
        padding: $sp3;
        @include font(light, normal, fs-100);
    }

    .group-details {
        flex: 1;
        color: var(--section-txt);
        overflow: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
        background-color: transparent;
    }

    .inner {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        padding: $sp3 $sp5 0 $sp5;

        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }
    }

    h4,
    h3 {
        margin-bottom: $sp3;
    }

    h3 {
        @include font(bold, normal, fs-120);
    }

    .group-name {
        margin-top: $sp4;
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
        // border: 1px solid var(--bd);
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

    .update-permissions {
        margin-top: $sp4;
    }

    .rules-button {
        margin-top: $sp4;
    }
</style>
