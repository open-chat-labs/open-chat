<script lang="ts">
    import { gateLabel } from "@src/utils/access";
    import {
        Body,
        BodySmall,
        Chip,
        CommonButton,
        Container,
        FloatingButton,
        Form,
        Input,
        ListAction,
        Switch,
        TextArea,
        UserChip,
    } from "component-lib";
    import { isDiamondStore, publish, type OpenChat } from "openchat-client";
    import { getContext, tick } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import AlertRhombusOutline from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import ClockOutline from "svelte-material-icons/ClockOutline.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import FormatList from "svelte-material-icons/FormatListBulletedType.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import AreYouSure from "../../AreYouSure.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import LinkedCard from "../../LinkedCard.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import DisappearingMessages from "./DisappearingMessages.svelte";
    import {
        MAX_DESC_LENGTH,
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        updateGroupState,
    } from "./group.svelte";

    const MIN_LENGTH = 3;
    const MAX_URL_LENGTH = 500;
    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;
    let canEditDisappearingMessages = $derived(
        !ugs.editMode ? true : client.hasOwnerRights(ugs.candidate.membership.role),
    );
    let requiresUpgrade = $derived(
        !ugs.editMode && !$isDiamondStore && ugs.candidate.level !== "channel",
    );
    let confirmExit = $state(false);
</script>

{#snippet rulesError()}
    {#if !ugs.rulesValid}
        Rules have validation errors
    {/if}
{/snippet}

{#if ugs.showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, ugs.candidateGroup.level, true)}
        action={(yes) => ugs.saveGroup(client, yes)} />
{/if}

{#if confirmExit}
    <AreYouSure
        title={i18nKey("Unsaved changes")}
        message={i18nKey("Are you sure that you want to close this page without saving?")}
        action={(yes) => {
            confirmExit = false;
            if (yes) {
                tick().then(() => publish("closeModalPage"));
            }
            return Promise.resolve();
        }} />
{/if}

<SlidingPageContent
    onBack={ugs.valid ? () => (confirmExit = true) : undefined}
    title={i18nKey(
        ugs.editMode ? "group.updateInfo" : "group.addGroupInfo",
        undefined,
        ugs.candidateGroup.level,
        true,
    )}
    subtitle={i18nKey(ugs.editMode ? "Update group" : "Create group")}>
    <Container
        supplementalClass={"group_info"}
        height={"fill"}
        gap={"xxl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <Container
            direction={"vertical"}
            crossAxisAlignment={"center"}
            supplementalClass={"group_avatar"}>
            <EditableAvatar
                highlightBorder
                disabled={ugs.busy}
                size={"headline"}
                image={ugs.candidateGroup.avatar?.blobUrl}
                onImageSelected={(image) => ugs.groupAvatarSelected(image)} />
        </Container>
        <Form onSubmit={() => ugs.saveGroup(client)}>
            <Container direction={"vertical"} gap={"lg"} supplementalClass={"group_basic_info"}>
                <Input
                    minlength={MIN_NAME_LENGTH}
                    maxlength={MAX_NAME_LENGTH}
                    countdown
                    disabled={ugs.busy}
                    error={!ugs.nameValid}
                    id={"group_name"}
                    placeholder={"Group name"}
                    bind:value={ugs.candidateGroup.name}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("Group name is required *")}
                        ></Translatable>
                    {/snippet}
                </Input>
                {#if ugs.embedded}
                    <Input
                        minlength={MIN_LENGTH}
                        maxlength={MAX_URL_LENGTH}
                        error={!ugs.urlValid}
                        disabled={ugs.busy}
                        placeholder={interpolate(
                            $_,
                            i18nKey(
                                "group.externalUrlPlaceholder",
                                undefined,
                                ugs.candidateGroup.level,
                                true,
                            ),
                        )}
                        bind:value={ugs.candidateGroup.externalUrl}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("group.externalUrlWarning")} />
                        {/snippet}
                    </Input>
                {/if}
                <TextArea
                    maxlength={MAX_DESC_LENGTH}
                    countdown
                    disabled={ugs.busy}
                    id={"group_desc"}
                    placeholder={"Description"}
                    bind:value={ugs.candidateGroup.description}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey("Optionally, tell us what your group is about")}
                        ></Translatable>
                    {/snippet}
                </TextArea>
            </Container>
        </Form>
        {#if requiresUpgrade}
            <DiamondUpgradeBox message={i18nKey("upgrade.groupMsg")} />
        {/if}
        <Container padding={["zero", "md"]} gap={"xxl"} direction={"vertical"}>
            <Setting
                disabled={requiresUpgrade}
                toggle={() => (ugs.candidateGroup.public = !ugs.candidateGroup.public)}
                info={"Groups are private by default, and limited to people you invite. Public channels must have unique names, and community members are automatically added to them."}>
                <Switch
                    disabled={requiresUpgrade}
                    width={"fill"}
                    reverse
                    bind:checked={ugs.candidateGroup.public}>
                    <Translatable resourceKey={i18nKey("Public group")}></Translatable>
                </Switch>
            </Setting>

            {#if !ugs.embedded}
                <Setting
                    toggle={() =>
                        (ugs.candidateGroup.historyVisible = !ugs.candidateGroup.historyVisible)}
                    info={"By default new memebers in the group will see all the previous messages that were sent within the group. Enable this option to hide chat history for new members."}>
                    <Switch width={"fill"} reverse bind:checked={ugs.candidateGroup.historyVisible}>
                        <Translatable resourceKey={i18nKey("Hide chat history for new members")}
                        ></Translatable>
                    </Switch>
                </Setting>

                {#if canEditDisappearingMessages}
                    <DisappearingMessages />
                {/if}
            {/if}
        </Container>
        {#if !ugs.hideInviteUsers}
            <Container padding={["zero", "md"]} direction={"vertical"} gap={"xl"}>
                <ListAction onClick={() => publish("addGroupMembers")}>
                    {#snippet icon(color)}
                        <AccountPlus {color} />
                    {/snippet}
                    Add members
                </ListAction>

                {#if ugs.candidateMembers.length > 0}
                    <Container direction={"vertical"}>
                        <Body fontWeight={"bold"}>
                            <Translatable resourceKey={i18nKey("Selected members")}></Translatable>
                        </Body>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable
                                resourceKey={i18nKey(
                                    "Members that will be added or invited to the newly created group",
                                )}></Translatable>
                        </BodySmall>
                    </Container>
                    <Container wrap gap={"sm"} crossAxisAlignment={"center"}>
                        {#each ugs.candidateMembers as { user } (user.userId)}
                            <UserChip
                                avatarUrl={client.userAvatarUrl(user)}
                                onRemove={() => ugs.deleteMember(user)}>@{user.username}</UserChip>
                        {/each}
                    </Container>
                {/if}
            </Container>
        {/if}

        <Container direction={"vertical"} gap={"lg"} supplementalClass={"group_sub_sections"}>
            <LinkedCard
                disabled={requiresUpgrade}
                onClick={() => publish("updateAccessGates", ugs)}
                Icon={AlertRhombusOutline}
                title={i18nKey("Access gates")}
                info={i18nKey(
                    "Fine tune who can join your group by setting specific access gates.",
                )}>
                <Container wrap gap={"sm"}>
                    {#each ugs.accessGates as gate}
                        <Chip mode={"filter"}>
                            {#snippet icon(color)}
                                <Check {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}
                            ></Translatable>
                        </Chip>
                    {/each}
                    {#if ugs.candidateGroup.gateConfig.expiry !== undefined}
                        <Chip>
                            {#snippet icon(color)}
                                <ClockOutline {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Evaluation interval set")}
                            ></Translatable>
                        </Chip>
                    {/if}
                </Container>
            </LinkedCard>
            {#if !ugs.embedded}
                <LinkedCard
                    error={ugs.rulesValid ? undefined : rulesError}
                    onClick={() => publish("updateRules", ugs)}
                    Icon={FormatList}
                    title={i18nKey("Rules")}
                    info={i18nKey(
                        "Define a set of rules that the members of your group will have to follow.",
                    )}>
                    {#if ugs.candidateGroup.rules.enabled}
                        <Chip>
                            {#snippet icon(color)}
                                <AlertOutline {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Rules enabled")}></Translatable>
                        </Chip>
                    {/if}
                </LinkedCard>
            {/if}
            <LinkedCard
                onClick={() => publish("updateGroupPermissions")}
                Icon={AccountMultiple}
                title={i18nKey("Permissions")}
                info={i18nKey(
                    "Define which user groups can access certain features within the group.",
                )} />
        </Container>
        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
            <CommonButton
                mode={"active"}
                onClick={() => publish("closeModalPage")}
                size={"small_text"}>
                <Translatable resourceKey={i18nKey("cancel")}></Translatable>
            </CommonButton>
            {#if !ugs.editMode}
                <CommonButton
                    disabled={!ugs.valid}
                    loading={ugs.busy}
                    onClick={() => ugs.saveGroup(client)}
                    size={"medium"}
                    mode={"active"}>
                    {#snippet icon(color, size)}
                        <AccountGroup {color} {size}></AccountGroup>
                    {/snippet}
                    <Translatable
                        resourceKey={i18nKey(
                            ugs.editMode ? "group.update" : "group.create",
                            undefined,
                            ugs.candidateGroup.level,
                            true,
                        )}></Translatable>
                </CommonButton>
            {/if}
        </Container>
    </Container>
    {#if ugs.editMode}
        <FloatingButton
            disabled={!ugs.valid}
            loading={ugs.busy}
            pos={{ bottom: "lg", right: "lg" }}
            onClick={() => ugs.saveGroup(client)}>
            {#snippet icon(color)}
                <Save {color} />
            {/snippet}
        </FloatingButton>
    {/if}
</SlidingPageContent>
