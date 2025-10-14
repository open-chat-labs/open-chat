<script lang="ts">
    import { i18nKey, supportedLanguages } from "@src/i18n/i18n";
    import { gateLabel } from "@src/utils/access";
    import {
        Body,
        BodySmall,
        Chip,
        CommonButton,
        Container,
        Form,
        IconButton,
        Input,
        TextArea,
        UserChip,
    } from "component-lib";
    import { publish, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import AlertRhombusOutline from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import ClockOutline from "svelte-material-icons/ClockOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import FormatList from "svelte-material-icons/FormatListBulletedType.svelte";
    import ImageEditOutline from "svelte-material-icons/ImageEditOutline.svelte";
    import AreYouSure from "../../../AreYouSure.svelte";
    import EditableAvatar from "../../../EditableAvatar.svelte";
    import EditableImageWrapper from "../../../EditableImageWrapper.svelte";
    import LinkedCard from "../../../LinkedCard.svelte";
    import Translatable from "../../../Translatable.svelte";
    import LanguageSelector from "../../LanguageSelector.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import {
        MAX_DESC_LENGTH,
        MAX_NAME_LENGTH,
        MIN_NAME_LENGTH,
        updateCommunityState,
    } from "./community.svelte";

    const client = getContext<OpenChat>("client");
    const gradient =
        "linear-gradient(90deg, var(--warning) 0%, var(--primary) 30%, var(--primary) 70%, var(--tertiary) 100%)";

    let ucs = updateCommunityState;

    let selectedLanguage = $derived(
        supportedLanguages.find((l) => l.code === ucs.candidate.primaryLanguage),
    );
</script>

{#snippet rulesError()}
    {#if !ucs.rulesValid}
        Rules have validation errors
    {/if}
{/snippet}

{#if ucs.showingVerificationWarning}
    <AreYouSure
        message={i18nKey("verified.nameChangeWarning", undefined, ucs.candidate.level, true)}
        action={(yes) => ucs.saveCommunity(client, yes)} />
{/if}

<SlidingPageContent
    title={i18nKey(
        ucs.editMode ? "Update community info" : "Add community info",
        undefined,
        ucs.candidate.level,
        true,
    )}
    subtitle={i18nKey(ucs.editMode ? "Update community" : "Create community")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <EditableImageWrapper
            classString={"user_profile_background"}
            image={ucs.candidate.banner?.blobUrl}
            onImageSelected={(image) => ucs.bannerSelected(image)}
            mode={"profile"}>
            {#snippet children(choosePhoto: () => void)}
                <Container direction={"vertical"}>
                    <Container
                        borderRadius={"md"}
                        minHeight={"11.5rem"}
                        mainAxisAlignment={"end"}
                        padding={"sm"}
                        gap={"xs"}
                        backgroundImage={ucs.candidate.banner?.blobUrl}
                        background={gradient}>
                        <IconButton onclick={choosePhoto} size={"md"} mode={"dark"}>
                            {#snippet icon(color)}
                                <ImageEditOutline {color} />
                            {/snippet}
                        </IconButton>
                    </Container>
                    <Container
                        supplementalClass={"user_profile_editable_avatar"}
                        gap={"lg"}
                        crossAxisAlignment={"start"}
                        padding={["zero", "lg"]}
                        direction="vertical">
                        <EditableAvatar
                            onImageSelected={(image) => ucs.avatarSelected(image)}
                            image={ucs.candidate.avatar?.blobUrl}
                            size={"headline"} />
                    </Container>
                </Container>
            {/snippet}
        </EditableImageWrapper>
        <Form onSubmit={() => ucs.saveCommunity(client)}>
            <Container direction={"vertical"} gap={"lg"}>
                <Input
                    minlength={MIN_NAME_LENGTH}
                    maxlength={MAX_NAME_LENGTH}
                    countdown
                    disabled={ucs.busy}
                    error={!ucs.nameValid}
                    id={"group_name"}
                    placeholder={"Community name"}
                    bind:value={ucs.candidate.name}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("Community name is required *")}
                        ></Translatable>
                    {/snippet}
                </Input>
                <LanguageSelector
                    selected={selectedLanguage}
                    onSelect={(lang) => (ucs.candidate.primaryLanguage = lang.code)}
                    placeholder={"Choose your preferred language"}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey(
                                "This does not apply to messages sent or received",
                            )}></Translatable>
                    {/snippet}
                </LanguageSelector>
                <TextArea
                    maxlength={MAX_DESC_LENGTH}
                    countdown
                    disabled={ucs.busy}
                    id={"community_desc"}
                    placeholder={"Description"}
                    bind:value={ucs.candidate.description}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey(
                                "Optionally, tell us what your community is about",
                            )}></Translatable>
                    {/snippet}
                </TextArea>
            </Container>
        </Form>
        {#if ucs.candidateMembers.length > 0}
            <Container direction={"vertical"} gap={"md"}>
                <Container direction={"vertical"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Selected members")}></Translatable>
                    </Body>

                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Members that will be added or invited to the newly created community",
                            )}></Translatable>
                    </BodySmall>
                </Container>
                <Container wrap gap={"sm"} crossAxisAlignment={"center"}>
                    {#each ucs.candidateMembers as { user } (user.userId)}
                        <UserChip
                            avatarUrl={client.userAvatarUrl(user)}
                            onRemove={() => ucs.deleteMember(user)}>@{user.username}</UserChip>
                    {/each}
                </Container>
            </Container>
        {/if}

        <Container direction={"vertical"} gap={"lg"} supplementalClass={"group_sub_sections"}>
            <LinkedCard
                onClick={() => publish("updateCommunityGeneralSetup")}
                Icon={Cog}
                title={i18nKey("General setup")}
                info={i18nKey(
                    "Enable sharing via link, disappearing messages, or hide chat history for new members.",
                )} />
            <LinkedCard
                onClick={() => publish("updateAccessGates", ucs)}
                Icon={AlertRhombusOutline}
                title={i18nKey("Access gates")}
                info={i18nKey(
                    "Fine tune who can join your community by setting specific access gates.",
                )}>
                <Container wrap gap={"sm"}>
                    {#each ucs.accessGates as gate}
                        <Chip mode={"filter"}>
                            {#snippet icon(color)}
                                <Check {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}
                            ></Translatable>
                        </Chip>
                    {/each}
                    {#if ucs.candidate.gateConfig.expiry !== undefined}
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
            <LinkedCard
                error={ucs.rulesValid ? undefined : rulesError}
                onClick={() => publish("updateGroupRules")}
                Icon={FormatList}
                title={i18nKey("Rules")}
                info={i18nKey(
                    "Define a set of rules that the members of your community will have to follow.",
                )}>
                {#if ucs.rules.enabled}
                    <Chip>
                        {#snippet icon(color)}
                            <AlertOutline {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Rules enabled")}></Translatable>
                    </Chip>
                {/if}
            </LinkedCard>
            <LinkedCard
                Icon={AccountMultiple}
                title={i18nKey("Permissions")}
                info={i18nKey(
                    "Define which user groups can access certain features within the group.",
                )} />
        </Container>
        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
            <CommonButton onClick={() => publish("closeModalPage")} size={"small_text"}>
                <Translatable resourceKey={i18nKey("group.back")}></Translatable>
            </CommonButton>
            <CommonButton
                disabled={!ucs.valid}
                loading={ucs.busy}
                onClick={() => ucs.saveCommunity(client)}
                size={"medium"}
                mode={"active"}>
                {#snippet icon(color)}
                    <AccountGroup {color}></AccountGroup>
                {/snippet}
                <Translatable
                    resourceKey={i18nKey(
                        ucs.editMode ? "Update community" : "Create community",
                        undefined,
                        ucs.candidate.level,
                        true,
                    )}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
