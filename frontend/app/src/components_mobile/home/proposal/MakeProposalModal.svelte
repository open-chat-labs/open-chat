<script lang="ts">
    import BotPublisher from "@src/components/bots/BotPublisher.svelte";
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
        cryptoBalanceStore,
        currentUserIdStore,
        currentUserStore,
        routeForChatIdentifier,
        type CandidateProposalAction,
        type MultiUserChat,
        type NervousSystemDetails,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { isPrincipalValid, isUrl, random32, type ExternalBot } from "openchat-shared";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import EyeIcon from "svelte-material-icons/EyeOutline.svelte";
    import PencilIcon from "svelte-material-icons/PencilOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import {
        createAddTokenPayload,
        createPublishExternalBotPayload,
        createRegisterExternalAchievementPayload,
        createUpdateTokenPayload,
    } from "../../../utils/sns";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Legend from "../../Legend.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import DurationSelector from "../DurationSelector.svelte";
    import Markdown from "../Markdown.svelte";
    import RemoveBot from "./RemoveBot.svelte";
    import TransferSnsFunds from "./TransferSNSFunds.svelte";
    import VerificationProposal from "./VerificationProposal.svelte";

    const MIN_TITLE_LENGTH = 3;
    const MAX_TITLE_LENGTH = 120;
    const MAX_URL_LENGTH = 2000;
    const MIN_SUMMARY_LENGTH = 3;
    const MAX_SUMMARY_LENGTH = 10000;
    const CANISTER_ID_LENGTH = 27;
    const MIN_ACHIEVEMENT_NAME_LENGTH = 3;
    const MAX_ACHIEVEMENT_NAME_LENGTH = 45;
    const MIN_CHIT_REWARD = 5000;
    const MIN_AWARDS = 200;
    const CHAT_FEE_PER_CHIT_AWARD: bigint = 20_000n; // 1/5000th of a CHAT
    const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;
    const TOKEN_LISTING_FEE: bigint = 50_000_100_000n; // 500 CHAT + transfer fee

    const PROPOSALS_BOT_CANISTER = import.meta.env.OC_PROPOSALS_BOT_CANISTER!;
    const REGISTRY_CANISTER = import.meta.env.OC_REGISTRY_CANISTER!;
    const USER_INDEX_CANISTER = import.meta.env.OC_USER_INDEX_CANISTER!;

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedMultiUserChat: MultiUserChat;
        nervousSystem: NervousSystemDetails;
        onClose: () => void;
    }

    let { selectedMultiUserChat, nervousSystem, onClose }: Props = $props();

    type ProposalType =
        | "motion"
        | "publish_bot"
        | "remove_bot"
        | "transfer_sns_funds"
        | "register_external_achievement"
        | "advance_sns_target_version"
        | "add_token"
        | "update_token"
        | "set_community_verification"
        | "set_group_verification"
        | "revoke_community_verification"
        | "revoke_group_verification";

    let title = $state("");
    let url = $state("");
    let summary = $state("");
    let achievementExpiry: bigint = $state(BigInt(ONE_MONTH));
    let achievementExpiryValid = $state(true);
    let chitRewardText = $state("5000");
    let maxAwardsText = $state("200");
    let step = $state(-1);
    let summaryPreview = $state(false);
    let busy = $state(true);
    let selectedProposalType: ProposalType | undefined = $state(undefined);
    let error: string | undefined = $state(undefined);
    let depositMessage: ResourceKey | undefined = $state(undefined);
    let depositError = $state(true);
    let refreshingBalance = $state(false);
    let balanceWithRefresh: BalanceWithRefresh;
    let achivementName = $state("");
    let selectedBot: ExternalBot | undefined = $state(undefined);
    //@ts-ignore
    let transferSnsFunds: TransferSnsFunds | undefined = $state();
    //@ts-ignore
    let verificationComponent: VerificationProposal | undefined = $state();
    //@ts-ignore
    let removeBotComponent: RemoveBot | undefined;
    let transferSnsFundsValid: boolean = $state(false);
    let removeBotValid: boolean = $state(false);
    let verificationValid: boolean = $state(false);

    function summaryDescription(type: typeof selectedProposalType): [ResourceKey, ResourceKey] {
        switch (type) {
            case "set_community_verification":
            case "set_group_verification":
            case "revoke_community_verification":
            case "revoke_group_verification":
                return [i18nKey("verified.evidenceLabel"), i18nKey("verified.evidencePlaceholder")];
            case "remove_bot":
                return [
                    i18nKey("bots.manage.removeReason"),
                    i18nKey("bots.manage.removeReasonPlaceholder"),
                ];
            default:
                return [i18nKey("proposal.maker.summary"), i18nKey("proposal.maker.enterSummary")];
        }
    }

    function defaultMessage(): ResourceKey {
        const cost = client.formatTokens(requiredFunds, tokenDetails.decimals);
        return i18nKey("proposal.maker.message", { cost, token: symbol });
    }

    async function onClickPrimary(): Promise<void> {
        if (step === 0) {
            balanceWithRefresh.refresh();
        } else if (canSubmit) {
            onSubmit();
        } else if (step === 1) {
            step = 2;
        }
    }

    async function onSubmit(): Promise<void> {
        if (!valid) return;

        busy = true;

        const pin = await client.promptForPinIfRequired();

        if (
            !(await approvePayment(
                PROPOSALS_BOT_CANISTER,
                proposalCost + BigInt(2) * transferFee,
                pin,
            ))
        ) {
            busy = false;
            return;
        }

        if (
            selectedProposalType === "register_external_achievement" ||
            selectedProposalType === "add_token"
        ) {
            const addToken = selectedProposalType === "add_token";
            let spender = addToken ? REGISTRY_CANISTER : USER_INDEX_CANISTER;
            let amount = addToken ? TOKEN_LISTING_FEE : achievementChatCost;

            if (!(await approvePayment(spender, amount, pin))) {
                busy = false;
                return;
            }
        }

        const action = convertAction();

        if (action === undefined) {
            busy = false;
            return;
        }

        client
            .submitProposal(nervousSystem.governanceCanisterId, {
                title,
                url: url === "" ? undefined : url,
                summary,
                action,
            })
            .then((success) => {
                busy = false;
                if (success) {
                    onClose();
                } else {
                    error = "unexpectedError";
                }
            });
    }

    function convertAction(): CandidateProposalAction | undefined {
        switch (selectedProposalType) {
            case "motion":
            case "advance_sns_target_version":
                return { kind: selectedProposalType };
            case "transfer_sns_funds": {
                return transferSnsFunds?.convertAction();
            }
            case "remove_bot": {
                return removeBotComponent?.convertAction();
            }
            case "set_community_verification":
            case "revoke_community_verification":
            case "set_group_verification":
            case "revoke_group_verification": {
                return verificationComponent?.convertAction();
            }
            case "add_token": {
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(7000),
                    payload: createAddTokenPayload(
                        addOrUpdateTokenLedgerCanisterId,
                        $currentUserIdStore,
                        addOrUpdateTokenInfoUrl,
                        addOrUpdateTokenTransactionUrlFormat,
                        undefined,
                    ),
                };
            }
            case "update_token": {
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(7001),
                    payload: createUpdateTokenPayload(
                        addOrUpdateTokenLedgerCanisterId,
                        undefined,
                        undefined,
                        addOrUpdateTokenInfoUrl,
                        addOrUpdateTokenTransactionUrlFormat,
                        undefined,
                    ),
                };
            }
            case "register_external_achievement": {
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(1012),
                    payload: createRegisterExternalAchievementPayload(
                        random32(),
                        $currentUserIdStore,
                        achivementName,
                        achievementUrl,
                        logo,
                        awardingAchievementCanisterId,
                        chitReward,
                        BigInt(Date.now()) + achievementExpiry,
                        maxAwards,
                    ),
                };
            }
            case "publish_bot": {
                if (selectedBot === undefined) {
                    throw new Error("No bot has been selected - this should not happen");
                }
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(1015),
                    payload: createPublishExternalBotPayload(selectedBot),
                };
            }
        }
    }

    async function approvePayment(
        spender_canister_id: string,
        amount: bigint,
        pin: string | undefined,
    ): Promise<boolean> {
        return client
            .approveTransfer(
                spender_canister_id,
                tokenDetails.ledger,
                amount,
                BigInt(Date.now() + 1000 * 60 * 60 * 24 * 5), // allow 5 days for proposal
                pin,
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    return true;
                } else if ($pinNumberErrorMessageStore === undefined) {
                    error = "approvalError";
                }

                return false;
            })
            .catch(() => {
                return false;
            });
    }

    function onStartRefreshingBalance() {
        refreshingBalance = true;
    }

    function onRefreshingBalanceSuccess() {
        if (step === -1) {
            step = insufficientFunds ? 0 : 1;
            busy = false;
            if (!insufficientFunds) {
                depositError = false;
            }
        } else if (step === 0 && !insufficientFunds) {
            step = 1;
            depositError = false;
        }

        refreshingBalance = false;
    }

    function onRefreshingBalanceFailed() {
        depositMessage = i18nKey("Failed to refresh balance");
        depositError = true;
        refreshingBalance = false;
    }

    function wrappedSummary(summary: string) {
        const groupPath = routeForChatIdentifier(
            selectedMultiUserChat.kind === "group_chat" ? "chats" : "community",
            selectedMultiUserChat.id,
        );

        return `${summary}

> Submitted by [@${$currentUserStore.username}](https://oc.app/user/${$currentUserIdStore}) on [OpenChat](https://oc.app${groupPath})`;
    }

    function isLogoValid(logo: string): boolean {
        return logo.length === 0 || isUrl(logo);
    }
    let errorMessage = $derived(
        error !== undefined ? i18nKey("proposal.maker." + error) : $pinNumberErrorMessageStore,
    );
    let tokenDetails = $derived(nervousSystem.token);
    let ledger = $derived(tokenDetails.ledger);
    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? BigInt(0));
    let symbol = $derived(tokenDetails.symbol);
    let transferFee = $derived(tokenDetails.transferFee);
    let proposalCost = $derived(nervousSystem.proposalRejectionFee);
    let requiredFunds = $derived(proposalCost + BigInt(3) * transferFee);
    let chitReward = $derived(Number(chitRewardText));
    let chitRewardValid = $derived(chitReward >= MIN_CHIT_REWARD);
    let maxAwards = $derived(Number(maxAwardsText));
    let achievementChatCost = $derived(
        BigInt(chitReward * maxAwards) * CHAT_FEE_PER_CHIT_AWARD + tokenDetails.transferFee,
    );
    let insufficientFunds = $derived(cryptoBalance < requiredFunds);
    let insufficientFundsForPayment = $derived(
        cryptoBalance <
            requiredFunds +
                (selectedProposalType === "register_external_achievement"
                    ? achievementChatCost
                    : selectedProposalType === "add_token"
                      ? TOKEN_LISTING_FEE
                      : BigInt(0)),
    );
    let titleValid = $derived(title.length >= MIN_TITLE_LENGTH && title.length <= MAX_TITLE_LENGTH);
    let urlValid = $derived(url.length <= MAX_URL_LENGTH);
    let summaryValid = $derived(
        summary.length >= MIN_SUMMARY_LENGTH && summary.length <= MAX_SUMMARY_LENGTH,
    );
    let maxAwardsValid = $derived(maxAwards >= MIN_AWARDS);
    let achievementNameValid = $derived(
        achivementName.length >= MIN_ACHIEVEMENT_NAME_LENGTH &&
            achivementName.length <= MAX_ACHIEVEMENT_NAME_LENGTH,
    );
    let addOrUpdateTokenLedgerCanisterId = $state("");

    let addOrUpdateTokenInfoUrl = $state("");

    let addOrUpdateTokenTransactionUrlFormat = $state("");

    let logo = $state("");

    let achievementUrl = $state("");

    let awardingAchievementCanisterId = $state("");

    let valid = $derived(
        selectedProposalType !== undefined &&
            !insufficientFunds &&
            !insufficientFundsForPayment &&
            titleValid &&
            urlValid &&
            summaryValid &&
            (selectedProposalType === "motion" ||
                selectedProposalType === "advance_sns_target_version" ||
                (selectedProposalType === "publish_bot" && selectedBot !== undefined) ||
                (selectedProposalType === "remove_bot" && removeBotValid) ||
                (selectedProposalType === "transfer_sns_funds" && transferSnsFundsValid) ||
                (selectedProposalType === "set_community_verification" && verificationValid) ||
                (selectedProposalType === "set_group_verification" && verificationValid) ||
                (selectedProposalType === "register_external_achievement" &&
                    achievementNameValid &&
                    chitRewardValid &&
                    maxAwardsValid &&
                    achievementExpiryValid &&
                    isLogoValid(logo) &&
                    achievementUrl.length > 0 &&
                    awardingAchievementCanisterId.length > 0 &&
                    isPrincipalValid(awardingAchievementCanisterId)) ||
                (selectedProposalType === "add_token" &&
                    isPrincipalValid(addOrUpdateTokenLedgerCanisterId) &&
                    addOrUpdateTokenTransactionUrlFormat.length > 0) ||
                (selectedProposalType === "update_token" &&
                    isPrincipalValid(addOrUpdateTokenLedgerCanisterId) &&
                    addOrUpdateTokenTransactionUrlFormat.length > 0)),
    );
    let canSubmit = $derived(
        step === 2 ||
            (step === 1 &&
                (selectedProposalType === "motion" ||
                    selectedProposalType === "advance_sns_target_version")),
    );
    $effect(() => {
        if (tokenDetails !== undefined) {
            depositMessage = defaultMessage();
        }
    });
    let [summaryLabel, summaryPlaceholder] = $derived(summaryDescription(selectedProposalType));

    let proposalOptions = $derived.by<{ name: string; value: ProposalType }[]>(() => {
        const options: { name: string; value: ProposalType }[] = [
            { name: "Motion", value: "motion" },
            { name: "Transfer SNS funds", value: "transfer_sns_funds" },
            { name: "Advance SNS target version", value: "advance_sns_target_version" },
        ];

        if (symbol === "CHAT" || true) {
            options.push(
                { name: "Register external achievement", value: "register_external_achievement" },
                { name: "Add token", value: "add_token" },
                { name: "Update token", value: "update_token" },
                { name: "Publish a bot", value: "publish_bot" },
                { name: interpolate($_, i18nKey("bots.manage.remove")), value: "remove_bot" },
                {
                    name: interpolate($_, i18nKey("verified.verify", undefined, "community", true)),
                    value: "set_community_verification",
                },
                {
                    name: interpolate($_, i18nKey("verified.verify", undefined, "group", true)),
                    value: "set_group_verification",
                },
                {
                    name: interpolate($_, i18nKey("verified.revoke", undefined, "community", true)),
                    value: "revoke_community_verification",
                },
                {
                    name: interpolate($_, i18nKey("verified.revoke", undefined, "group", true)),
                    value: "revoke_group_verification",
                },
            );
        }

        return options;
    });
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Row crossAxisAlignment={"center"} mainAxisAlignment={"spaceBetween"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("proposal.maker.header")} />
            </Subtitle>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {ledger}
                value={cryptoBalance}
                onClick={onStartRefreshingBalance}
                onRefreshed={onRefreshingBalanceSuccess}
                onError={onRefreshingBalanceFailed} />
        </Row>
        <Column gap={"lg"}>
            {#if step === 0}
                <AccountInfo {ledger} />
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} />
                </Body>
            {:else if step === 1}
                <Select
                    onSelect={(val) => (selectedProposalType = val)}
                    placeholder={interpolate($_, i18nKey("proposal.maker.selectType"))}
                    value={selectedProposalType}>
                    {#snippet selectedValue(val)}
                        {val}
                    {/snippet}
                    {#snippet selectOptions(onSelect)}
                        <Column padding={"lg"}>
                            {#each proposalOptions as { name, value }}
                                <Option
                                    {value}
                                    onClick={onSelect}
                                    selected={selectedProposalType === value}>
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
                    disabled={busy}
                    error={title.length > 0 && !titleValid}
                    bind:value={title}
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
                    disabled={busy}
                    error={!urlValid}
                    bind:value={url}
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
                                background={ColourVars.textTertiary}
                                padding={["md", "xl", "xs", "xl"]}
                                borderRadius={"xxl"}
                                height={{ size: "12rem" }}
                                gap={"sm"}
                                crossAxisAlignment={"start"}>
                                <Body>
                                    <Markdown inline={false} text={wrappedSummary(summary)} />
                                </Body>
                            </Row>
                        {:else}
                            <TextArea
                                rows={8}
                                disabled={busy}
                                error={summary.length > 0 && !summaryValid}
                                bind:value={summary}
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
            {:else if step === 2}
                {#if selectedProposalType === "set_community_verification" || selectedProposalType === "revoke_community_verification" || selectedProposalType === "set_group_verification" || selectedProposalType === "revoke_group_verification"}
                    <VerificationProposal
                        bind:this={verificationComponent}
                        bind:valid={verificationValid}
                        type={selectedProposalType} />
                {:else if selectedProposalType === "publish_bot"}
                    <BotPublisher bind:selected={selectedBot}></BotPublisher>
                {:else if selectedProposalType === "remove_bot"}
                    <RemoveBot bind:valid={removeBotValid}></RemoveBot>
                {:else if selectedProposalType === "transfer_sns_funds"}
                    <TransferSnsFunds
                        bind:valid={transferSnsFundsValid}
                        bind:this={transferSnsFunds}
                        {nervousSystem} />
                {:else if selectedProposalType === "register_external_achievement"}
                    <Input
                        autofocus
                        disabled={busy}
                        error={achivementName.length > 0 && !achievementNameValid}
                        bind:value={achivementName}
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
                        disabled={busy}
                        minlength={1}
                        maxlength={100}
                        bind:value={achievementUrl}
                        countdown
                        required
                        placeholder={interpolate($_, i18nKey("https://myapp.xyz/register"))}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("proposal.maker.achievementUrl")} />
                        {/snippet}
                    </Input>
                    <Input
                        disabled={busy}
                        error={!isLogoValid(logo)}
                        minlength={0}
                        maxlength={50000}
                        bind:value={logo}
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
                        disabled={busy}
                        error={awardingAchievementCanisterId.length > 0 &&
                            !isPrincipalValid(awardingAchievementCanisterId)}
                        bind:value={awardingAchievementCanisterId}
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
                        disabled={busy}
                        error={chitRewardText.length > 0 && !chitRewardValid}
                        minlength={4}
                        maxlength={5}
                        required
                        bind:value={chitRewardText}
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
                        disabled={busy}
                        error={maxAwardsText.length > 0 && !maxAwardsValid}
                        minlength={3}
                        maxlength={8}
                        required
                        bind:value={maxAwardsText}
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
                        <DurationSelector bind:duration={achievementExpiry}>
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
                {:else if selectedProposalType === "add_token" || selectedProposalType === "update_token"}
                    <section>
                        <Legend label={i18nKey("proposal.maker.ledgerCanisterId")} required />
                        <Input
                            autofocus
                            disabled={busy}
                            error={addOrUpdateTokenLedgerCanisterId.length > 0 &&
                                !isPrincipalValid(addOrUpdateTokenLedgerCanisterId)}
                            bind:value={addOrUpdateTokenLedgerCanisterId}
                            minlength={CANISTER_ID_LENGTH}
                            maxlength={CANISTER_ID_LENGTH}
                            countdown
                            placeholder={interpolate($_, i18nKey("2ouva-viaaa-aaaaq-aaamq-cai"))} />
                    </section>
                    <section>
                        <Legend
                            label={i18nKey("proposal.maker.tokenInfoUrl")}
                            required={selectedProposalType === "add_token"} />
                        <Input
                            disabled={busy}
                            minlength={1}
                            maxlength={100}
                            bind:value={addOrUpdateTokenInfoUrl}
                            countdown
                            placeholder={interpolate($_, i18nKey("https://token.com/info"))} />
                    </section>
                    <section>
                        <Legend
                            label={i18nKey("proposal.maker.transactionUrlFormat")}
                            required={selectedProposalType === "add_token"} />
                        <Input
                            disabled={busy}
                            minlength={1}
                            maxlength={200}
                            bind:value={addOrUpdateTokenTransactionUrlFormat}
                            countdown
                            placeholder={interpolate(
                                $_,
                                i18nKey(`https://token.com/transactions/{transaction_index}`),
                            )} />
                    </section>
                {/if}
            {/if}
        </Column>

        <!-- Footer -->
        <Column gap={"lg"}>
            {#if (selectedProposalType === "register_external_achievement" || selectedProposalType === "add_token") && step === 2}
                <Body colour={insufficientFundsForPayment ? "error" : "textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "proposal.maker." +
                                (selectedProposalType === "add_token"
                                    ? "addTokenChatCost"
                                    : "achievementChatCost"),
                            {
                                cost: client.formatTokens(
                                    selectedProposalType === "add_token"
                                        ? TOKEN_LISTING_FEE
                                        : achievementChatCost,
                                    8,
                                ),
                                chat: "CHAT",
                            },
                        )} />
                </Body>
            {/if}
            {#if depositMessage !== undefined}
                <Body colour={depositError ? "error" : "textSecondary"}>
                    <Translatable resourceKey={depositMessage} />
                </Body>
            {/if}
            {#if errorMessage !== undefined}
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            {/if}

            <Row crossAxisAlignment={"center"} gap={"md"} mainAxisAlignment={"end"}>
                {#if step > 1 || (step == 1 && insufficientFunds)}
                    <CommonButton
                        size={"small_text"}
                        disabled={busy}
                        onClick={() => (step = step - 1)}
                        ><Translatable resourceKey={i18nKey("group.back")} /></CommonButton>
                {/if}
                <CommonButton size={"small_text"} disabled={busy} onClick={onClose}
                    >{$_("cancel")}</CommonButton>

                <CommonButton
                    mode={"active"}
                    size={"medium"}
                    disabled={busy || (canSubmit && !valid) || selectedProposalType === undefined}
                    loading={busy || refreshingBalance}
                    onClick={onClickPrimary}
                    ><Translatable
                        resourceKey={i18nKey(
                            step === 0 ? "refresh" : canSubmit ? "submit" : "group.next",
                        )} /></CommonButton>
            </Row>
        </Column>
    </Column>
</Sheet>
