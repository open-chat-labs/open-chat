<script lang="ts">
    import { gateLabel } from "@src/utils/access";
    import {
        Body,
        BodySmall,
        Chip,
        CommonButton,
        Container,
        Form,
        Input,
        TextArea,
        UserChip,
    } from "component-lib";
    import {
        isCompositeGate,
        isLeafGate,
        type CandidateGroupChat,
        type CandidateMember,
        type LeafGate,
        type OpenChat,
        type UserOrUserGroup,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import AlertRhombusOutline from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import ClockOutline from "svelte-material-icons/ClockOutline.svelte";
    import Cog from "svelte-material-icons/Cog.svelte";
    import FormatList from "svelte-material-icons/FormatListBulletedType.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import LinkedCard from "../../LinkedCard.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    const MAX_DESC_LENGTH = 1024;

    interface Props {
        rulesValid: boolean;
        nameValid: boolean;
        candidateGroup: CandidateGroupChat;
        candidateMembers: CandidateMember[];
        onDeleteUser: (user: UserOrUserGroup) => void;
        valid: boolean;
        onBack: () => void;
        busy?: boolean;
        onCreateGroup?: () => void;
        onGeneralSetup?: () => void;
        onRules?: () => void;
        onAccessGates?: () => void;
        minNameLength: number;
        maxNameLength: number;
    }

    let {
        rulesValid,
        nameValid,
        minNameLength,
        maxNameLength,
        candidateMembers = $bindable(),
        candidateGroup = $bindable(),
        onDeleteUser,
        valid,
        onBack,
        busy = false,
        onCreateGroup,
        onGeneralSetup,
        onRules,
        onAccessGates,
    }: Props = $props();

    let accessGates = $derived.by<LeafGate[]>(() => {
        if (candidateGroup.gateConfig.gate.kind === "no_gate") return [];
        if (isLeafGate(candidateGroup.gateConfig.gate)) return [candidateGroup.gateConfig.gate];
        if (isCompositeGate(candidateGroup.gateConfig.gate))
            return candidateGroup.gateConfig.gate.gates;
        return [];
    });

    function groupAvatarSelected(detail: { url: string; data: Uint8Array }) {
        candidateGroup.avatar = {
            blobUrl: detail.url,
            blobData: detail.data,
        };
    }
</script>

{#snippet rulesError()}
    {#if !rulesValid}
        Rules have validation errors
    {/if}
{/snippet}

<Container
    supplementalClass={"group_info"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={["xxl", "lg", "lg", "lg"]}>
    <Container
        direction={"vertical"}
        crossAxisAlignment={"center"}
        supplementalClass={"group_avatar"}>
        <EditableAvatar
            highlightBorder
            disabled={busy}
            size={"headline"}
            image={candidateGroup.avatar?.blobUrl}
            onImageSelected={groupAvatarSelected} />
    </Container>
    <Form onSubmit={() => console.log("On submit")}>
        <Container direction={"vertical"} gap={"lg"} supplementalClass={"group_basic_info"}>
            <Input
                minlength={minNameLength}
                maxlength={maxNameLength}
                countdown
                disabled={busy}
                error={!nameValid}
                id={"group_name"}
                placeholder={"Group name"}
                bind:value={candidateGroup.name}>
                {#snippet subtext()}
                    <Translatable resourceKey={i18nKey("Group name is required *")}></Translatable>
                {/snippet}
            </Input>
            <TextArea
                maxlength={MAX_DESC_LENGTH}
                countdown
                disabled={busy}
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
    {#if candidateMembers.length > 0}
        <Container direction={"vertical"} gap={"md"}>
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
                {#each candidateMembers as { user } (user.userId)}
                    <UserChip
                        avatarUrl={client.userAvatarUrl(user)}
                        onRemove={() => onDeleteUser(user)}>@{user.username}</UserChip>
                {/each}
            </Container>
        </Container>
    {/if}

    <Container direction={"vertical"} gap={"lg"} supplementalClass={"group_sub_sections"}>
        <LinkedCard
            onClick={onGeneralSetup}
            Icon={Cog}
            title={i18nKey("General setup")}
            info={i18nKey(
                "Enable sharing via link, disappearing messages, or hide chat history for new members.",
            )} />
        <LinkedCard
            onClick={onAccessGates}
            Icon={AlertRhombusOutline}
            title={i18nKey("Access gates")}
            info={i18nKey("Fine tune who can join your group by setting specific access gates.")}>
            <Container wrap gap={"sm"}>
                {#each accessGates as gate}
                    <Chip mode={"filter"}>
                        {#snippet icon(color)}
                            <Check {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}></Translatable>
                    </Chip>
                {/each}
                {#if candidateGroup.gateConfig.expiry !== undefined}
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
            error={rulesValid ? undefined : rulesError}
            onClick={onRules}
            Icon={FormatList}
            title={i18nKey("Rules")}
            info={i18nKey(
                "Define a set of rules that the members of your group will have to follow.",
            )}>
            {#if candidateGroup.rules.enabled}
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
        <CommonButton onClick={onBack} size={"small_text"}>
            <Translatable resourceKey={i18nKey("group.back")}></Translatable>
        </CommonButton>
        <CommonButton
            disabled={!valid}
            loading={busy}
            onClick={onCreateGroup}
            size={"medium"}
            mode={"active"}>
            {#snippet icon(color)}
                <AccountGroup {color}></AccountGroup>
            {/snippet}
            <Translatable
                resourceKey={i18nKey("group.create", undefined, candidateGroup.level, true)}
            ></Translatable>
        </CommonButton>
    </Container>
</Container>
