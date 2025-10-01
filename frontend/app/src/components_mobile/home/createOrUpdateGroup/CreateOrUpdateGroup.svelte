<script lang="ts">
    import {
        ColourVars,
        CommonButton,
        Container,
        Form,
        Input,
        SectionHeader,
        TextArea,
    } from "component-lib";
    import {
        type CandidateGroupChat,
        type CandidateMember,
        chatIdentifierUnset,
        chatListScopeStore,
        type CreateGroupResponse,
        type Level,
        type MultiUserChatIdentifier,
        type OpenChat,
        type ResourceKey,
        ROLE_ADMIN,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
        UnsupportedValueError,
        type UpdateGroupResponse,
        type UserSummary,
    } from "openchat-client";
    import { ErrorCode } from "openchat-shared";
    import page from "page";
    import { getContext, tick } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AlertRhombusOutline from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import FormatList from "svelte-material-icons/FormatListBulletedType.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import AreYouSure from "../../AreYouSure.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import LinkedCard from "../../LinkedCard.svelte";
    import Translatable from "../../Translatable.svelte";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 40;
    const MAX_DESC_LENGTH = 1024;
    const client = getContext<OpenChat>("client");

    interface Props {
        candidateGroup: CandidateGroupChat;
        embeddedContent: boolean;
        onClose: () => void;
    }

    let { candidateGroup = $bindable(), embeddedContent, onClose }: Props = $props();
    let confirming = $state(false);
    let showingVerificationWarning = $state(false);
    let busy = $state(false);
    let step = $state("details");
    let actualWidth = $state(0);
    let detailsValid = $state(true);
    let visibilityValid = $state(true);
    let originalGroup = $state<CandidateGroupChat>($state.snapshot(candidateGroup));
    let rulesValid = $state(true);
    let usersToInvite = $state<CandidateMember[]>([]);

    let nameIsValid =
        candidateGroup.name.length >= MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;

    function getSteps(
        editing: boolean,
        detailsValid: boolean,
        visibilityValid: boolean,
        rulesValid: boolean,
        hideInviteUsers: boolean,
        embeddedContent: boolean,
    ) {
        let steps = [
            { key: "details", labelKey: "group.details", valid: detailsValid },
            { key: "visibility", labelKey: "access.visibility", valid: visibilityValid },
        ];

        if (!embeddedContent) {
            steps.push({ key: "rules", labelKey: "rules.rules", valid: rulesValid });
        }

        steps.push({ key: "permissions", labelKey: "permissions.permissions", valid: true });

        if (!editing && !hideInviteUsers) {
            steps.push({ key: "invite", labelKey: "invite.invite", valid: true });
        }
        return steps;
    }

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            $selectedCommunitySummaryStore === undefined ||
            client.canInviteUsers($selectedCommunitySummaryStore.id);
        return client.searchUsersForInvite(term, 20, candidateGroup.level, true, canInvite);
    }

    function groupUpdateErrorMessage(
        resp: UpdateGroupResponse,
        level: Level,
    ): ResourceKey | undefined {
        console.log("Group update response: ", resp);
        if (resp.kind === "success") return undefined;
        if (resp.kind === "unchanged") return undefined;
        if (resp.kind === "name_too_short") return i18nKey("groupNameTooShort");
        if (resp.kind === "name_too_long") return i18nKey("groupNameTooLong");
        if (resp.kind === "name_reserved") return i18nKey("groupNameReserved");
        if (resp.kind === "desc_too_long") return i18nKey("groupDescTooLong");
        if (resp.kind === "name_taken" && level === "group") return i18nKey("groupAlreadyExists");
        if (resp.kind === "name_taken") return i18nKey("channelAlreadyExists");
        if (resp.kind === "not_in_group") return i18nKey("userNotInGroup");
        if (resp.kind === "internal_error") return i18nKey("groupUpdateFailed");
        if (resp.kind === "not_authorized") return i18nKey("groupUpdateFailed");
        if (resp.kind === "avatar_too_big") return i18nKey("avatarTooBig");
        if (resp.kind === "rules_too_short") return i18nKey("groupRulesTooShort");
        if (resp.kind === "rules_too_long") return i18nKey("groupRulesTooLong");
        if (resp.kind === "user_suspended") return i18nKey("userSuspended");
        if (resp.kind === "user_lapsed") return i18nKey("userLapsed");
        if (resp.kind === "chat_frozen") return i18nKey("chatFrozen");
        if (resp.kind === "failure" || resp.kind === "error") return i18nKey("failure");
        if (resp.kind === "offline") return i18nKey("offlineError");
        if (resp.kind === "access_gate_invalid") return i18nKey("access.gateInvalid");
        throw new UnsupportedValueError(`Unexpected UpdateGroupResponse type received`, resp);
    }

    function groupCreationErrorMessage(
        resp: CreateGroupResponse,
        level: Level,
    ): ResourceKey | undefined {
        if (resp.kind === "success") return undefined;
        if (resp.kind === "offline") return i18nKey("offlineError");
        if (resp.kind === "error") {
            if (resp.code === ErrorCode.NameTooShort) return i18nKey("groupNameTooShort");
            if (resp.code === ErrorCode.NameTooLong) return i18nKey("groupNameTooLong");
            if (resp.code === ErrorCode.NameReserved) return i18nKey("groupNameReserved");
            if (resp.code === ErrorCode.DescriptionTooLong) return i18nKey("groupDescTooLong");
            if (resp.code === ErrorCode.NameTaken && level === "group")
                return i18nKey("groupAlreadyExists");
            if (resp.code === ErrorCode.NameTaken) return i18nKey("channelAlreadyExists");
            if (resp.code === ErrorCode.AvatarTooBig) return i18nKey("groupAvatarTooBig");
            if (resp.code === ErrorCode.MaxGroupsCreated) return i18nKey("maxGroupsCreated");
            if (resp.code === ErrorCode.Throttled) return i18nKey("groupCreationFailed");
            if (resp.code === ErrorCode.RulesTooShort) return i18nKey("groupRulesTooShort");
            if (resp.code === ErrorCode.RulesTooLong) return i18nKey("groupRulesTooLong");
            if (resp.code === ErrorCode.InitiatorSuspended) return i18nKey("userSuspended");
            if (resp.code === ErrorCode.NotDiamondMember)
                return i18nKey("unauthorizedToCreatePublicGroup");
            if (resp.code === ErrorCode.InvalidAccessGate) return i18nKey("access.gateInvalid");
        }
        return i18nKey("groupCreationFailed");
    }

    function optionallyInviteUsers(chatId: MultiUserChatIdentifier): Promise<void> {
        if (usersToInvite.length === 0) {
            return Promise.resolve();
        }
        return client
            .inviteUsers(
                chatId,
                usersToInvite.map((u) => u.user.userId),
            )
            .then((resp) => {
                if (!resp) {
                    Promise.reject("Unable to invite users to the new group");
                }
            });
    }

    function updateGroup(yes: boolean = true): Promise<void> {
        busy = true;

        const changeVisibility = visDirty && candidateGroup.public !== originalGroup.public;

        if (verificationWarning && !showingVerificationWarning) {
            showingVerificationWarning = true;
            return Promise.resolve();
        }

        if (changeVisibility && !confirming) {
            confirming = true;
            return Promise.resolve();
        }

        if (verificationWarning && showingVerificationWarning && !yes) {
            showingVerificationWarning = false;
            busy = false;
            candidateGroup.name = originalGroup.name;
            return Promise.resolve();
        }

        if (changeVisibility && confirming && !yes) {
            confirming = false;
            busy = false;
            return Promise.resolve();
        }

        confirming = false;

        const updatedGroup = $state.snapshot(candidateGroup);

        return client
            .updateGroup(
                updatedGroup.id,
                nameDirty ? updatedGroup.name : undefined,
                descDirty ? updatedGroup.description : undefined,
                rulesDirty && rulesValid ? updatedGroup.rules : undefined,
                permissionsDirty
                    ? client.diffGroupPermissions(
                          originalGroup.permissions,
                          updatedGroup.permissions,
                      )
                    : undefined,
                avatarDirty ? updatedGroup.avatar?.blobData : undefined,
                ttlDirty
                    ? updatedGroup.eventsTTL === undefined
                        ? "set_to_none"
                        : { value: updatedGroup.eventsTTL }
                    : undefined,
                gateDirty ? updatedGroup.gateConfig : undefined,
                visDirty ? updatedGroup.public : undefined,
                messagesVisibleToNonMembersDirty
                    ? updatedGroup.messagesVisibleToNonMembers
                    : undefined,
                externalUrlDirty ? updatedGroup.externalUrl : undefined,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    originalGroup = updatedGroup;
                } else {
                    const resourceKey = groupUpdateErrorMessage(resp, updatedGroup.level);
                    if (resourceKey) {
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level: updatedGroup.level,
                            lowercase: true,
                        });
                    }
                }
            })
            .finally(() => {
                busy = false;
                onClose();
            });
    }

    function createGroup() {
        busy = true;

        const level = candidateGroup.level;

        client
            .createGroupChat($state.snapshot(candidateGroup))
            .then((resp) => {
                if (resp.kind !== "success") {
                    const resourceKey = groupCreationErrorMessage(resp, level);
                    if (resourceKey)
                        toastStore.showFailureToast({
                            ...resourceKey,
                            level,
                            lowercase: true,
                        });
                    step = "details";
                } else if (!hideInviteUsers) {
                    optionallyInviteUsers(resp.canisterId).catch((_err) => {
                        toastStore.showFailureToast(i18nKey("inviteUsersFailed"));
                        step = "details";
                    });
                    onGroupCreated(resp.canisterId);
                } else {
                    onGroupCreated(resp.canisterId);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("groupCreationFailed"));
                console.error("Error creating group: ", err);
                step = "details";
            })
            .finally(() => (busy = false));
    }

    function onGroupCreated(canisterId: MultiUserChatIdentifier) {
        const url = routeForChatIdentifier($chatListScopeStore.kind, canisterId);
        onClose();
        // tick ensure that the new chat will have made its way in to the chat list by the time we arrive at the route
        tick().then(() => page(url)); // trigger the selection of the chat
    }

    let editing = $derived(!chatIdentifierUnset(candidateGroup.id));
    let hideInviteUsers = $derived(candidateGroup.level === "channel" && candidateGroup.public);
    let steps = $derived(
        getSteps(
            editing,
            detailsValid,
            visibilityValid,
            rulesValid,
            hideInviteUsers,
            embeddedContent,
        ),
    );
    let stepIndex = $derived(steps.findIndex((s) => s.key === step) ?? 0);
    let canEditPermissions = $derived(
        !editing ? true : client.canChangePermissions(candidateGroup.id),
    );
    let canEditDisappearingMessages = $derived(
        !editing ? true : client.hasOwnerRights(candidateGroup.membership.role),
    );
    let permissionsDirty = $derived(
        client.haveGroupPermissionsChanged(originalGroup.permissions, candidateGroup.permissions),
    );
    let rulesDirty = $derived(
        editing &&
            candidateGroup.rules !== undefined &&
            (candidateGroup.rules.enabled !== originalGroup.rules.enabled ||
                candidateGroup.rules.text !== originalGroup.rules.text),
    );
    let nameDirty = $derived(editing && candidateGroup.name !== originalGroup.name);
    let descDirty = $derived(editing && candidateGroup.description !== originalGroup.description);
    let externalUrlDirty = $derived(
        editing && candidateGroup.externalUrl !== originalGroup.externalUrl,
    );
    let avatarDirty = $derived(
        editing && candidateGroup.avatar?.blobUrl !== originalGroup.avatar?.blobUrl,
    );
    let visDirty = $derived(editing && candidateGroup.public !== originalGroup.public);
    let infoDirty = $derived(nameDirty || descDirty || avatarDirty || externalUrlDirty);
    let gateDirty = $derived(
        editing && client.hasAccessGateChanged(candidateGroup.gateConfig, originalGroup.gateConfig),
    );
    let ttlDirty = $derived(editing && candidateGroup.eventsTTL !== originalGroup.eventsTTL);
    let messagesVisibleToNonMembersDirty = $derived(
        editing &&
            candidateGroup.messagesVisibleToNonMembers !==
                originalGroup.messagesVisibleToNonMembers,
    );
    let dirty = $derived(
        infoDirty ||
            rulesDirty ||
            permissionsDirty ||
            visDirty ||
            gateDirty ||
            ttlDirty ||
            messagesVisibleToNonMembersDirty,
    );
    let valid = $derived(detailsValid && visibilityValid && rulesValid);
    $effect(() => {
        if (candidateGroup.public) {
            candidateGroup.permissions.startVideoCall = ROLE_ADMIN;
        }
    });
    let verificationWarning = $derived(nameDirty && editing && originalGroup.verified);

    function groupAvatarSelected(detail: { url: string; data: Uint8Array }) {
        candidateGroup.avatar = {
            blobUrl: detail.url,
            blobData: detail.data,
        };
    }
</script>

{#if confirming}
    <AreYouSure
        message={i18nKey(
            `confirmMakeGroup${candidateGroup.public ? "Public" : "Private"}`,
            undefined,
            candidateGroup.level,
            true,
        )}
        action={updateGroup} />
{/if}

{#if showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, candidateGroup.level, true)}
        action={updateGroup} />
{/if}

<Container
    backgroundColour={ColourVars.background0}
    mainAxisAlignment={"spaceBetween"}
    direction={"vertical"}
    height={{ kind: "fill" }}>
    <SectionHeader onBack={onClose}>
        {#snippet title()}
            <Translatable
                resourceKey={i18nKey(
                    "group.addGroupInfo",
                    undefined,
                    candidateGroup.level,
                    true,
                )} />
        {/snippet}
        {#snippet subtitle()}
            <Translatable
                resourceKey={i18nKey("group.createTitle", undefined, candidateGroup.level, true)} />
        {/snippet}
    </SectionHeader>

    <Container height={{ kind: "fill" }} gap={"xxl"} direction={"vertical"}>
        <Container
            direction={"vertical"}
            crossAxisAlignment={"center"}
            supplementalClass={"group_avatar"}>
            <EditableAvatar
                size={"headline"}
                image={candidateGroup.avatar?.blobUrl}
                onImageSelected={groupAvatarSelected} />
        </Container>

        <Form onSubmit={() => console.log("On submit")}>
            <Container
                padding={["zero", "lg"]}
                direction={"vertical"}
                gap={"lg"}
                supplementalClass={"group_basic_info"}>
                <Input
                    minlength={MIN_LENGTH}
                    maxlength={MAX_LENGTH}
                    countdown
                    id={"group_name"}
                    placeholder={"Group name"}
                    bind:value={candidateGroup.name}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("Group name is required *")}
                        ></Translatable>
                    {/snippet}
                </Input>
                <TextArea
                    maxlength={MAX_DESC_LENGTH}
                    countdown
                    id={"group_desc"}
                    placeholder={"Description"}
                    bind:value={candidateGroup.description}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey("Optionally, tell us what your group is about")}
                        ></Translatable>
                    {/snippet}
                </TextArea>
            </Container>
        </Form>

        <Container
            padding={["zero", "lg"]}
            direction={"vertical"}
            gap={"lg"}
            supplementalClass={"group_sub_sections"}>
            <LinkedCard
                Icon={Cog}
                title={i18nKey("General setup")}
                info={i18nKey(
                    "Enable sharing via link, disappearing messages, or hide chat history for new members.",
                )} />
            <LinkedCard
                Icon={AlertRhombusOutline}
                title={i18nKey("Access gates")}
                info={i18nKey(
                    "Fine tune who can join your group by setting specific access gates.",
                )} />
            <LinkedCard
                Icon={FormatList}
                title={i18nKey("Rules")}
                info={i18nKey(
                    "Define a set of rules that the members of your group will ahve to follow.",
                )} />
            <LinkedCard
                Icon={AccountMultiple}
                title={i18nKey("Permissions")}
                info={i18nKey(
                    "Define which user groups can access certain features within the group.",
                )} />
        </Container>
    </Container>

    <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"} padding={"lg"}>
        <CommonButton onClick={onClose} size={"small_text"}>
            <Translatable resourceKey={i18nKey("group.back")}></Translatable>
        </CommonButton>
        <CommonButton onClick={() => console.log("create")} size={"medium"} mode={"active"}>
            {#snippet icon(color)}
                <AccountGroup {color}></AccountGroup>
            {/snippet}
            <Translatable
                resourceKey={i18nKey("group.create", undefined, candidateGroup.level, true)}
            ></Translatable>
        </CommonButton>
    </Container>
</Container>

<!-- <ModalContent bind:actualWidth closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable
                resourceKey={editing
                    ? i18nKey("group.edit", undefined, candidateGroup.level, true)
                    : i18nKey("group.createTitle", undefined, candidateGroup.level, true)} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <StageHeader {steps} enabled onStep={(s) => (step = s)} {step} />
            <div use:menuCloser class="wrapper">
                {#if step === "details"}
                    <div class="details">
                        <GroupDetails
                            {embeddedContent}
                            bind:valid={detailsValid}
                            {busy}
                            bind:candidateGroup />
                    </div>
                {/if}
                {#if step === "visibility"}
                    <div class="visibility">
                        <VisibilityControl
                            {embeddedContent}
                            {editing}
                            history
                            {canEditDisappearingMessages}
                            bind:valid={visibilityValid}
                            bind:candidate={candidateGroup}
                            {gateDirty} />
                    </div>
                {/if}
                {#if !embeddedContent && step === "rules"}
                    <div class="rules">
                        <RulesEditor
                            bind:valid={rulesValid}
                            level={candidateGroup.level}
                            bind:rules={candidateGroup.rules}
                            {editing} />
                    </div>
                {/if}
                {#if step === "permissions"}
                    <div class="permissions">
                        {#if canEditPermissions}
                            <GroupPermissionsEditor
                                {embeddedContent}
                                {editing}
                                bind:permissions={candidateGroup.permissions}
                                isPublic={candidateGroup.public}
                                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                                isChannel={candidateGroup.id.kind === "channel"} />
                        {:else}
                            <GroupPermissionsViewer
                                {embeddedContent}
                                permissions={candidateGroup.permissions}
                                isPublic={candidateGroup.public}
                                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                                isChannel={candidateGroup.id.kind === "channel"} />
                        {/if}
                    </div>
                {/if}
                {#if !editing && !hideInviteUsers && step === "invite"}
                    <div class="members">
                        <ChooseMembers
                            userLookup={searchUsers}
                            bind:members={usersToInvite}
                            {busy} />
                    </div>
                {/if}
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <span class="footer">
            <div class="group-buttons">
                <div class="back">
                    {#if !editing && stepIndex > 0}
                        <Button
                            disabled={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => (step = steps[stepIndex - 1].key)}
                            ><Translatable resourceKey={i18nKey("group.back")} /></Button>
                    {/if}
                </div>
                <div class="actions">
                    <Button
                        disabled={false}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={onClose}
                        secondary><Translatable resourceKey={i18nKey("cancel")} /></Button>

                    {#if editing}
                        <Button
                            disabled={!dirty || busy || !valid}
                            loading={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => updateGroup()}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.update",
                                    undefined,
                                    candidateGroup.level,
                                    true,
                                )} /></Button>
                    {:else if stepIndex < steps.length - 1}
                        <Button
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => (step = steps[stepIndex + 1].key)}
                            ><Translatable resourceKey={i18nKey("group.next")} />
                        </Button>
                    {:else}
                        <Button
                            disabled={busy || !valid}
                            loading={busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={createGroup}
                            ><Translatable
                                resourceKey={i18nKey(
                                    "group.create",
                                    undefined,
                                    candidateGroup.level,
                                    true,
                                )} /></Button>
                    {/if}
                </div>
            </div>
        </span>
    {/snippet}
</ModalContent> -->

<style lang="scss">
    :global(.group-buttons button:not(.loading)) {
        @include mobile() {
            min-width: 0 !important;
        }
    }

    :global(.group-buttons .actions button) {
        height: auto;
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .group-buttons {
        display: flex;
        justify-content: space-between;
        width: 100%;
        gap: $sp3;

        .back {
            display: flex;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: $sp3;
        }
    }

    .wrapper {
        width: 100%;
        height: 550px;
        display: flex;
        @include nice-scrollbar();
        overflow-y: scroll;
        scrollbar-gutter: stable;

        @include mobile() {
            height: 400px;
        }
    }

    .details,
    .visibility,
    .rules,
    .members,
    .permissions {
        width: 100%;
    }
</style>
