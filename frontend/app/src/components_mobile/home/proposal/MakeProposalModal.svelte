<script lang="ts">
    import {
        Body,
        BodySmall,
        Caption,
        ColourVars,
        Column,
        CommonButton,
        Input,
        Option,
        Row,
        Select,
        Sheet,
        Subtitle,
        TextArea,
    } from "component-lib";
    import {
        formatTokens,
        type MultiUserChat,
        type NervousSystemDetails,
        type OpenChat,
    } from "@client";
    import { isPrincipalValid } from "@shared";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import EyeIcon from "svelte-material-icons/EyeOutline.svelte";
    import PencilIcon from "svelte-material-icons/PencilOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { proposalTypesFor, type ProposalType } from "../../../utils/proposalTypes";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import {
        CANISTER_ID_LENGTH,
        MAX_ACHIEVEMENT_NAME_LENGTH,
        MAX_SUMMARY_LENGTH,
        MAX_TITLE_LENGTH,
        MAX_URL_LENGTH,
        MIN_ACHIEVEMENT_NAME_LENGTH,
        MIN_AWARDS,
        MIN_CHIT_REWARD,
        MIN_SUMMARY_LENGTH,
        MIN_TITLE_LENGTH,
        ProposalForm,
    } from "@shared_components/home/proposal/proposalForm.svelte";
    import BotPublisher from "../../bots/BotPublisher.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Legend from "../../Legend.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import DurationSelector from "../DurationSelector.svelte";
    import Markdown from "@shared_components/Markdown.svelte";
    import RemoveBot from "./RemoveBot.svelte";
    import TransferSnsFunds from "./TransferSNSFunds.svelte";
    import VerificationProposal from "./VerificationProposal.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedMultiUserChat: MultiUserChat;
        nervousSystem: NervousSystemDetails;
        onClose: () => void;
    }

    let { selectedMultiUserChat, nervousSystem, onClose }: Props = $props();

    const form = new ProposalForm(
        client,
        untrack(() => selectedMultiUserChat),
        untrack(() => nervousSystem),
    );
    let balanceWithRefresh: BalanceWithRefresh;
    let summaryPreview = $state(false);

    async function onClickPrimary(): Promise<void> {
        if (form.step === "deposit") {
            balanceWithRefresh?.refresh();
        } else if (form.canSubmit) {
            const outcome = await form.submit();
            switch (outcome.kind) {
                case "submitted":
                    onClose();
                    break;
                case "cancelled":
                case "invalid":
                case "failed":
                    break;
                default:
                    outcome satisfies never;
            }
        } else {
            form.next();
        }
    }

    let errorMessage = $derived($pinNumberErrorMessageStore ?? form.error);
    let symbol = $derived(nervousSystem.token.symbol);
    let [summaryLabel, summaryPlaceholder] = $derived(form.summaryLabels);

    let proposalTypeNames = $derived<Record<ProposalType, string>>({
        motion: "Motion",
        transfer_sns_funds: "Transfer SNS funds",
        advance_sns_target_version: "Advance SNS target version",
        register_external_achievement: "Register external achievement",
        add_token: "Add token",
        update_token: "Update token",
        publish_bot: "Publish a bot",
        remove_bot: interpolate($_, i18nKey("bots.manage.remove")),
        set_community_verification: interpolate(
            $_,
            i18nKey("verified.verify", undefined, "community", true),
        ),
        set_group_verification: interpolate($_, i18nKey("verified.verify", undefined, "group", true)),
        revoke_community_verification: interpolate(
            $_,
            i18nKey("verified.revoke", undefined, "community", true),
        ),
        revoke_group_verification: interpolate($_, i18nKey("verified.revoke", undefined, "group", true)),
    });

    let proposalOptions = $derived(
        proposalTypesFor(symbol).map((value) => ({ name: proposalTypeNames[value], value })),
    );
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Row crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("proposal.maker.header")} />
            </Subtitle>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                ledger={form.ledger}
                value={form.balance}
                onClick={() => form.balanceRefreshStarted()}
                onRefreshed={() => form.balanceRefreshed()}
                onError={() => form.balanceRefreshFailed()} />
        </Row>
        <Column gap={"lg"}>
            {#if form.step === "deposit"}
                <AccountInfo ledger={form.ledger} />
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} />
                </Body>
            {:else if form.step === "details"}
                <Select
                    onSelect={(val) => (form.type = val)}
                    placeholder={interpolate($_, i18nKey("proposal.maker.selectType"))}
                    value={form.type}>
                    {#snippet selectedValue(val)}
                        {val}
                    {/snippet}
                    {#snippet selectOptions(onSelect)}
                        <Column padding={"lg"}>
                            {#each proposalOptions as { name, value }}
                                <Option
                                    {value}
                                    onClick={onSelect}
                                    selected={form.type === value}>
                                    {name}
                                </Option>
                            {/each}
                        </Column>
                    {/snippet}
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("proposal.maker.selectType")} />
                    {/snippet}
                </Select>

                <Input
                    autofocus
                    disabled={form.busy}
                    error={form.title.length > 0 && !form.titleValid}
                    bind:value={form.title}
                    minlength={MIN_TITLE_LENGTH}
                    maxlength={MAX_TITLE_LENGTH}
                    countdown
                    required
                    placeholder={interpolate($_, i18nKey("proposal.maker.enterTitle"))}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("proposal.maker.enterTitle")} />
                    {/snippet}
                </Input>

                <Input
                    disabled={form.busy}
                    error={!form.urlValid}
                    bind:value={form.url}
                    maxlength={MAX_URL_LENGTH}
                    countdown
                    placeholder={interpolate($_, i18nKey("proposal.maker.enterUrl"))}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("proposal.maker.urlRules")} />
                    {/snippet}
                </Input>

                <Column gap={"xs"}>
                    <Column>
                        {#if summaryPreview}
                            <Row
                                background={ColourVars.inputBackground}
                                padding={["md", "xl", "xs", "xl"]}
                                borderRadius={"xxl"}
                                height={{ size: "12rem" }}
                                gap={"sm"}
                                crossAxisAlignment={"start"}>
                                <Body>
                                    <Markdown inline={false} text={form.summaryPreview} />
                                </Body>
                            </Row>
                        {:else}
                            <TextArea
                                rows={8}
                                disabled={form.busy}
                                error={form.summary.length > 0 && !form.summaryValid}
                                bind:value={form.summary}
                                minlength={MIN_SUMMARY_LENGTH}
                                maxlength={MAX_SUMMARY_LENGTH}
                                placeholder={interpolate($_, summaryPlaceholder)}></TextArea>
                        {/if}
                    </Column>
                    <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
                        <Legend
                            required
                            label={summaryLabel}
                            rules={i18nKey("proposal.maker.summaryRules")} />
                        <Row
                            onClick={() => (summaryPreview = !summaryPreview)}
                            width={"hug"}
                            padding={["zero", "xl", "zero", "zero"]}
                            gap={"xs"}
                            crossAxisAlignment={"center"}>
                            <Caption colour={"textSecondary"}>
                                <Translatable
                                    resourceKey={i18nKey(summaryPreview ? "edit" : "preview")} />
                            </Caption>
                            {#if summaryPreview}
                                <PencilIcon color={ColourVars.textSecondary} />
                            {:else}
                                <EyeIcon color={ColourVars.textSecondary} />
                            {/if}
                        </Row>
                    </Row>
                </Column>
            {:else if form.step === "action"}
                {#if form.type === "set_community_verification" || form.type === "revoke_community_verification" || form.type === "set_group_verification" || form.type === "revoke_group_verification"}
                    <VerificationProposal
                        bind:this={form.subForm}
                        bind:valid={form.subFormValid}
                        type={form.type} />
                {:else if form.type === "publish_bot"}
                    <BotPublisher bind:selected={form.selectedBot}></BotPublisher>
                {:else if form.type === "remove_bot"}
                    <RemoveBot bind:this={form.subForm} bind:valid={form.subFormValid}></RemoveBot>
                {:else if form.type === "transfer_sns_funds"}
                    <TransferSnsFunds
                        bind:valid={form.subFormValid}
                        bind:this={form.subForm}
                        {nervousSystem} />
                {:else if form.type === "register_external_achievement"}
                    <Input
                        autofocus
                        disabled={form.busy}
                        error={form.achievementName.length > 0 && !form.achievementNameValid}
                        bind:value={form.achievementName}
                        required
                        minlength={MIN_ACHIEVEMENT_NAME_LENGTH}
                        maxlength={MAX_ACHIEVEMENT_NAME_LENGTH}
                        countdown
                        placeholder={interpolate(
                            $_,
                            i18nKey("proposal.maker.enterAchievementName"),
                        )}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey("proposal.maker.enterAchievementName")} />
                        {/snippet}
                    </Input>
                    <Input
                        disabled={form.busy}
                        minlength={1}
                        maxlength={100}
                        bind:value={form.achievementUrl}
                        countdown
                        required
                        placeholder={interpolate($_, i18nKey("https://myapp.xyz/register"))}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("proposal.maker.achievementUrl")} />
                        {/snippet}
                    </Input>
                    <Input
                        disabled={form.busy}
                        error={!form.logoValid}
                        minlength={0}
                        maxlength={50000}
                        bind:value={form.achievementLogo}
                        countdown
                        placeholder={interpolate(
                            $_,
                            i18nKey("data:image/svg+xml;base64,PHN2ZyB3aW..."),
                        )}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("proposal.maker.achievementLogo")} />
                        {/snippet}
                    </Input>
                    <Input
                        autofocus
                        disabled={form.busy}
                        error={form.awardingAchievementCanisterId.length > 0 &&
                            !isPrincipalValid(form.awardingAchievementCanisterId)}
                        bind:value={form.awardingAchievementCanisterId}
                        minlength={CANISTER_ID_LENGTH}
                        maxlength={CANISTER_ID_LENGTH}
                        required
                        countdown
                        placeholder={interpolate(
                            $_,
                            i18nKey("proposal.maker.awardingAchievementCanisterId"),
                        )}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey(
                                    "proposal.maker.awardingAchievementCanisterIdRules",
                                )} />
                        {/snippet}
                    </Input>
                    <Input
                        disabled={form.busy}
                        error={form.chitRewardText.length > 0 && !form.chitRewardValid}
                        minlength={4}
                        maxlength={5}
                        required
                        bind:value={form.chitRewardText}
                        placeholder={interpolate($_, i18nKey("proposal.maker.enterChitReward"))}>
                        {#snippet subtext()}
                            <Row gap={"xs"}>
                                <Translatable resourceKey={i18nKey("proposal.maker.chitReward")} />
                                (<Translatable
                                    resourceKey={i18nKey("proposal.maker.chitRewardRules", {
                                        value: MIN_CHIT_REWARD,
                                    })} />)
                            </Row>
                        {/snippet}
                    </Input>
                    <Input
                        disabled={form.busy}
                        error={form.maxAwardsText.length > 0 && !form.maxAwardsValid}
                        minlength={3}
                        maxlength={8}
                        required
                        bind:value={form.maxAwardsText}
                        placeholder={interpolate($_, i18nKey("proposal.maker.enterMaxAwards"))}>
                        {#snippet subtext()}
                            <Row gap={"xs"}>
                                <Translatable resourceKey={i18nKey("proposal.maker.maxAwards")} />
                                (<Translatable
                                    resourceKey={i18nKey("proposal.maker.maxAwardsRules", {
                                        value: MIN_AWARDS,
                                    })} />)
                            </Row>
                        {/snippet}
                    </Input>
                    <Column padding={["zero", "md"]}>
                        <DurationSelector bind:duration={form.achievementExpiry}>
                            {#snippet title()}
                                <Column>
                                    <Body>
                                        <Translatable
                                            resourceKey={i18nKey(
                                                "proposal.maker.achievementExpiry",
                                            )} />
                                    </Body>
                                    <BodySmall colour={"textSecondary"}>
                                        <Translatable
                                            resourceKey={i18nKey(
                                                "Specify how long you would like your promotion to run for",
                                            )} />
                                    </BodySmall>
                                </Column>
                            {/snippet}
                        </DurationSelector>
                    </Column>
                {:else if form.type === "add_token" || form.type === "update_token"}
                    <Input
                        autofocus
                        disabled={form.busy}
                        error={form.tokenLedgerCanisterId.length > 0 &&
                            !isPrincipalValid(form.tokenLedgerCanisterId)}
                        bind:value={form.tokenLedgerCanisterId}
                        minlength={CANISTER_ID_LENGTH}
                        maxlength={CANISTER_ID_LENGTH}
                        countdown
                        required
                        placeholder={interpolate($_, i18nKey("2ouva-viaaa-aaaaq-aaamq-cai"))}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey("proposal.maker.ledgerCanisterId")} />
                        {/snippet}
                    </Input>
                    <Input
                        disabled={form.busy}
                        minlength={1}
                        maxlength={100}
                        bind:value={form.tokenInfoUrl}
                        countdown
                        required={form.type === "add_token"}
                        placeholder={interpolate($_, i18nKey("https://token.com/info"))}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("proposal.maker.tokenInfoUrl")} />
                        {/snippet}
                    </Input>
                    <Input
                        disabled={form.busy}
                        minlength={1}
                        maxlength={200}
                        bind:value={form.tokenTransactionUrlFormat}
                        countdown
                        required={form.type === "add_token"}
                        placeholder={interpolate(
                            $_,
                            i18nKey(`https://token.com/transactions/{transaction_index}`),
                        )}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey("proposal.maker.transactionUrlFormat")} />
                        {/snippet}
                    </Input>
                {/if}
            {/if}
        </Column>

        <!-- Footer -->
        <Column gap={"lg"} padding={["zero", "md"]}>
            {#if (form.type === "register_external_achievement" || form.type === "add_token") && form.step === "action"}
                <Body colour={form.insufficientFundsForPayment ? "validationError" : "textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "proposal.maker." +
                                (form.type === "add_token"
                                    ? "addTokenChatCost"
                                    : "achievementChatCost"),
                            {
                                cost: formatTokens(form.executionPaymentAmount, 8),
                                chat: "CHAT",
                            },
                        )} />
                </Body>
            {/if}
            <Body colour={form.depositError ? "validationError" : "textSecondary"}>
                <Translatable resourceKey={form.depositMessage} />
            </Body>
            {#if errorMessage !== undefined}
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            {/if}

            <Row crossAxisAlignment={"center"} gap={"md"} mainAxisAlignment={"end"}>
                {#if form.canGoBack}
                    <CommonButton
                        size={"small_text"}
                        disabled={form.busy}
                        onClick={() => form.back()}
                        ><Translatable resourceKey={i18nKey("group.back")} /></CommonButton>
                {/if}
                <CommonButton size={"small_text"} disabled={form.busy} onClick={onClose}
                    >{$_("cancel")}</CommonButton>

                <CommonButton
                    mode={"active"}
                    size={"medium"}
                    disabled={form.busy || (form.canSubmit && !form.valid) || form.type === undefined}
                    loading={form.busy || form.refreshingBalance}
                    onClick={onClickPrimary}
                    ><Translatable
                        resourceKey={i18nKey(
                            form.step === "deposit" ? "refresh" : form.canSubmit ? "submit" : "group.next",
                        )} /></CommonButton>
            </Row>
        </Column>
    </Column>
</Sheet>
