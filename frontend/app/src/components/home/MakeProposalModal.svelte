<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import {
        routeForChatIdentifier,
        type CandidateProposalAction,
        type MultiUserChat,
        type NervousSystemDetails,
        type OpenChat,
        type ResourceKey,
        type Treasury,
        currentUser as user,
        cryptoBalance as cryptoBalanceStore,
    } from "openchat-client";
    import { isPrincipalValid, isSubAccountValid, isUrl, random32 } from "openchat-shared";
    import { iconSize } from "../../stores/iconSize";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import Input from "../Input.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import Radio from "../Radio.svelte";
    import PencilIcon from "svelte-material-icons/PencilOutline.svelte";
    import EyeIcon from "svelte-material-icons/EyeOutline.svelte";
    import Markdown from "./Markdown.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import {
        createAddTokenPayload,
        createRegisterExternalAchievementPayload,
        createUpdateTokenPayload,
    } from "../../utils/sns";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import DurationPicker from "./DurationPicker.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";

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
    const ONE_MONTH = 1000 * 60 * 60 * 24 * 7 * 4;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let selectedMultiUserChat: MultiUserChat;
    export let nervousSystem: NervousSystemDetails;

    let title = "";
    let url = "";
    let summary = "";
    let treasury: Treasury = "SNS";
    let amountText = "";
    let achievementExpiry: bigint = BigInt(ONE_MONTH);
    let achievementExpiryValid = true;
    let chitRewardText = "5000";
    let maxAwardsText = "200";
    let recipientOwner = "";
    let recipientSubaccount = "";
    let step = -1;
    let actualWidth = 0;
    let summaryPreview = false;
    let busy = true;
    let selectedProposalType:
        | "motion"
        | "transfer_sns_funds"
        | "upgrade_sns_to_next_version"
        | "register_external_acievement"
        | "add_token"
        | "update_token" = "motion";
    let error: string | undefined = undefined;
    let fundingMessage: ResourceKey | undefined = undefined;
    let fundingError = true;
    let summaryContainerHeight = 0;
    let summaryHeight = 0;
    let refreshingBalance = false;
    let balanceWithRefresh: BalanceWithRefresh;
    let achivementName = "";

    $: errorMessage =
        error !== undefined ? i18nKey("proposal.maker." + error) : $pinNumberErrorMessageStore;
    $: tokenDetails = nervousSystem.token;
    $: ledger = tokenDetails.ledger;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFee = tokenDetails.transferFee;
    $: proposalCost = nervousSystem.proposalRejectionFee;
    $: requiredFunds = proposalCost + transferFee + transferFee;
    $: chitReward = Number(chitRewardText);
    $: chitRewardValid = chitReward >= MIN_CHIT_REWARD;
    $: achievementChatCost =
        BigInt(chitReward * maxAwards) * CHAT_FEE_PER_CHIT_AWARD + tokenDetails.transferFee;
    $: insufficientFunds = cryptoBalance < requiredFunds;
    $: insufficientFundsForAchievement =
        cryptoBalance <
        requiredFunds +
            (selectedProposalType === "register_external_acievement" && step == 2
                ? achievementChatCost
                : BigInt(0));
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: token = treasury === "SNS" ? symbol : "ICP";
    $: titleValid = title.length >= MIN_TITLE_LENGTH && title.length <= MAX_TITLE_LENGTH;
    $: urlValid = url.length <= MAX_URL_LENGTH;
    $: summaryValid = summary.length >= MIN_SUMMARY_LENGTH && summary.length <= MAX_SUMMARY_LENGTH;
    $: amount = Number(amountText) * Number(Math.pow(10, tokenDetails.decimals));
    $: amountValid = amount >= transferFee;
    $: maxAwards = Number(maxAwardsText);
    $: maxAwardsValid = maxAwards >= MIN_AWARDS;
    $: recipientOwnerValid = isPrincipalValid(recipientOwner);
    $: recipientSubaccountValid =
        recipientSubaccount.length === 0 || isSubAccountValid(recipientSubaccount);
    $: achievementNameValid =
        achivementName.length >= MIN_ACHIEVEMENT_NAME_LENGTH &&
        achivementName.length <= MAX_ACHIEVEMENT_NAME_LENGTH;
    $: addOrUpdateTokenLedgerCanisterId = "";
    $: addOrUpdateTokenHowToBuyUrl = "";
    $: addOrUpdateTokenInfoUrl = "";
    $: addOrUpdateTokenTransactionUrlFormat = "";
    $: tokenLogo = "";
    $: achievementUrl = "";
    $: awardingAchievementCanisterId = "";
    $: valid =
        !insufficientFunds &&
        !insufficientFundsForAchievement &&
        titleValid &&
        urlValid &&
        summaryValid &&
        (selectedProposalType === "motion" ||
            selectedProposalType === "upgrade_sns_to_next_version" ||
            (selectedProposalType === "transfer_sns_funds" &&
                amountValid &&
                recipientOwnerValid &&
                recipientSubaccountValid) ||
            (selectedProposalType === "register_external_acievement" &&
                achievementNameValid &&
                chitRewardValid &&
                maxAwardsValid &&
                achievementExpiryValid &&
                isLogoValid(tokenLogo) &&
                achievementUrl.length > 0 &&
                awardingAchievementCanisterId.length > 0 &&
                isPrincipalValid(awardingAchievementCanisterId)) ||
            (selectedProposalType === "add_token" &&
                isPrincipalValid(addOrUpdateTokenLedgerCanisterId) &&
                addOrUpdateTokenHowToBuyUrl.length > 0 &&
                addOrUpdateTokenTransactionUrlFormat.length > 0 &&
                isLogoValid(tokenLogo)) ||
            (selectedProposalType === "update_token" &&
                isPrincipalValid(addOrUpdateTokenLedgerCanisterId) &&
                (addOrUpdateTokenHowToBuyUrl.length > 0 ||
                    addOrUpdateTokenTransactionUrlFormat.length > 0 ||
                    (tokenLogo.length > 0 && isLogoValid(tokenLogo)))));
    $: canSubmit =
        step === 2 ||
        (step === 1 &&
            (selectedProposalType === "motion" ||
                selectedProposalType === "upgrade_sns_to_next_version"));

    $: {
        if (tokenDetails !== undefined) {
            fundingMessage = defaultMessage();
        }
    }

    function defaultMessage(): ResourceKey {
        const cost = client.formatTokens(requiredFunds, tokenDetails.decimals);
        return i18nKey("proposal.maker.message", { cost, token: symbol });
    }

    function onClose() {
        dispatch("close");
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

        if (selectedProposalType === "register_external_acievement") {
            if (!(await approveExternalAchievementPayment())) {
                busy = false;
                return;
            }
        }

        const action = convertAction();

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
                    dispatch("close");
                } else {
                    error = "unexpectedError";
                }
            });
    }

    function convertAction(): CandidateProposalAction {
        switch (selectedProposalType) {
            case "motion":
            case "upgrade_sns_to_next_version":
                return { kind: selectedProposalType };
            case "transfer_sns_funds": {
                return {
                    kind: "transfer_sns_funds",
                    recipient: {
                        owner: recipientOwner,
                        subaccount:
                            recipientSubaccount.length > 0
                                ? recipientSubaccount.padStart(64, "0")
                                : undefined,
                    },
                    amount: BigInt(Math.floor(amount)),
                    treasury,
                };
            }
            case "add_token": {
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(7000),
                    payload: createAddTokenPayload(
                        addOrUpdateTokenLedgerCanisterId,
                        addOrUpdateTokenInfoUrl,
                        addOrUpdateTokenHowToBuyUrl,
                        addOrUpdateTokenTransactionUrlFormat,
                        tokenLogo,
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
                        addOrUpdateTokenHowToBuyUrl,
                        addOrUpdateTokenTransactionUrlFormat,
                        tokenLogo,
                    ),
                };
            }
            case "register_external_acievement": {
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(1012),
                    payload: createRegisterExternalAchievementPayload(
                        random32(),
                        $user.userId,
                        achivementName,
                        achievementUrl,
                        tokenLogo,
                        awardingAchievementCanisterId,
                        chitReward,
                        BigInt(Date.now()) + achievementExpiry,
                        maxAwards,
                    ),
                };
            }
        }
    }

    async function approveExternalAchievementPayment(): Promise<boolean> {
        return client
            .approveTransfer(
                process.env.USER_INDEX_CANISTER!,
                tokenDetails.ledger,
                achievementChatCost,
                BigInt(Date.now() + 1000 * 60 * 60 * 24 * 5), // allow 5 days for proposal
            )
            .then((resp) => {
                if (resp.kind === "success") {
                    return true;
                } else if ($pinNumberErrorMessageStore === undefined) {
                    error = "approvalError";
                }

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
                fundingError = false;
            }
        } else if (step === 0 && !insufficientFunds) {
            step = 1;
            fundingError = false;
        }

        refreshingBalance = false;
    }

    function onRefreshingBalanceFailed() {
        fundingMessage = i18nKey("Failed to refresh balance");
        fundingError = true;
        refreshingBalance = false;
    }

    function wrappedSummary(summary: string) {
        const groupPath = routeForChatIdentifier(
            selectedMultiUserChat.kind === "group_chat" ? "group_chat" : "community",
            selectedMultiUserChat.id,
        );

        return `${summary}

> Submitted by [@${$user.username}](https://oc.app/user/${$user.userId}) on [OpenChat](https://oc.app${groupPath})`;
    }

    function isLogoValid(logo: string): boolean {
        return logo.length === 0 || isUrl(logo);
    }
</script>

<ModalContent bind:actualWidth fill>
    <div class="header" slot="header">
        {$_("proposal.maker.header")}
        <BalanceWithRefresh
            bind:this={balanceWithRefresh}
            {ledger}
            value={cryptoBalance}
            label={i18nKey("cryptoAccount.shortBalanceLabel")}
            bold
            on:click={onStartRefreshingBalance}
            on:refreshed={onRefreshingBalanceSuccess}
            on:error={onRefreshingBalanceFailed} />
    </div>
    <div class="body" slot="body">
        <div class="sections" style={`left: -${left}px`}>
            <div class="topup hidden" class:visible={step === 0}>
                <AccountInfo {ledger} user={$user} />
                <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    <Translatable resourceKey={i18nKey("howToBuyToken", { token: symbol })} />
                </a>
            </div>
            <div class="common hidden" class:visible={step === 1}>
                <section class="type">
                    <Legend label={i18nKey("proposal.maker.type")} />
                    <Select bind:value={selectedProposalType} margin={false}>
                        <option value={"motion"}>Motion</option>
                        <option value={"transfer_sns_funds"}>Transfer SNS funds</option>
                        <option value={"upgrade_sns_to_next_version"}
                            >Upgrade SNS to next version</option>
                        {#if symbol === "CHAT"}
                            <option value={"register_external_acievement"}
                                >Register external achievement</option>
                            <!-- <option value={"add_token"}>Add token</option> -->
                            <option value={"update_token"}>Update token</option>
                        {/if}
                    </Select>
                </section>
                <section>
                    <Legend label={i18nKey("proposal.maker.title")} required />
                    <Input
                        autofocus
                        disabled={busy}
                        invalid={title.length > 0 && !titleValid}
                        bind:value={title}
                        minlength={MIN_TITLE_LENGTH}
                        maxlength={MAX_TITLE_LENGTH}
                        countdown
                        placeholder={i18nKey("proposal.maker.enterTitle")} />
                </section>
                <section>
                    <Legend
                        label={i18nKey("proposal.maker.url")}
                        rules={i18nKey("proposal.maker.urlRules")} />
                    <Input
                        disabled={busy}
                        invalid={!urlValid}
                        bind:value={url}
                        maxlength={MAX_URL_LENGTH}
                        countdown
                        placeholder={i18nKey("proposal.maker.enterUrl")} />
                </section>
                <section>
                    <div class="summary-heading">
                        <Legend
                            required
                            label={i18nKey("proposal.maker.summary")}
                            rules={i18nKey("proposal.maker.summaryRules")} />
                        <div
                            role="switch"
                            tabindex="1"
                            class="preview"
                            on:click={() => (summaryPreview = !summaryPreview)}>
                            <span class="text"
                                ><Translatable
                                    resourceKey={i18nKey(
                                        summaryPreview ? "edit" : "preview",
                                    )} /></span>
                            <span class="icon">
                                {#if summaryPreview}
                                    <PencilIcon size={$iconSize} viewBox="0 -3 24 24" />
                                {:else}
                                    <EyeIcon size={$iconSize} viewBox="0 -3 24 24" />
                                {/if}
                            </span>
                        </div>
                    </div>
                    <div style={`height: ${summaryContainerHeight}px`}>
                        {#if summaryPreview}
                            <div class="markdown" style={`height: ${summaryHeight}px`}>
                                <Markdown inline={false} text={wrappedSummary(summary)} />
                            </div>
                        {:else}
                            <TextArea
                                rows={8}
                                bind:outerHeight={summaryContainerHeight}
                                bind:innerHeight={summaryHeight}
                                disabled={busy}
                                invalid={summary.length > 0 && !summaryValid}
                                bind:value={summary}
                                margin={false}
                                scroll
                                minlength={MIN_SUMMARY_LENGTH}
                                maxlength={MAX_SUMMARY_LENGTH}
                                placeholder={i18nKey("proposal.maker.enterSummary")} />
                        {/if}
                    </div>
                </section>
            </div>
            <div class="action hidden" class:visible={step === 2}>
                {#if selectedProposalType === "transfer_sns_funds"}
                    <div>
                        <section>
                            <Legend label={i18nKey("proposal.maker.treasury")} required />
                            <Radio
                                id="chat_treasury"
                                group="treasury"
                                value={symbol}
                                label={i18nKey(symbol)}
                                disabled={busy}
                                checked={treasury === "SNS"}
                                on:change={() => (treasury = "SNS")} />
                            <Radio
                                id="icp_treasury"
                                group="treasury"
                                value="ICP"
                                label={i18nKey("ICP")}
                                disabled={busy}
                                checked={treasury === "ICP"}
                                on:change={() => (treasury = "ICP")} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.recipientOwner")} required />
                            <Input
                                disabled={busy}
                                invalid={recipientOwner.length > 0 && !recipientOwnerValid}
                                maxlength={63}
                                bind:value={recipientOwner}
                                placeholder={i18nKey("proposal.maker.enterRecipientOwner")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.recipientSubaccount")}
                                rules={i18nKey("proposal.maker.recipientSubaccountRules")} />
                            <Input
                                disabled={busy}
                                invalid={!recipientSubaccountValid}
                                maxlength={64}
                                bind:value={recipientSubaccount}
                                placeholder={i18nKey("proposal.maker.enterRecipientSubaccount")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.amount")}
                                rules={i18nKey("proposal.maker.amountRules", { token })}
                                required />
                            <Input
                                disabled={busy}
                                invalid={amountText.length > 0 && !amountValid}
                                minlength={1}
                                maxlength={20}
                                bind:value={amountText}
                                placeholder={i18nKey("proposal.maker.enterAmount", {
                                    token,
                                })} />
                        </section>
                    </div>
                {:else if selectedProposalType === "register_external_acievement"}
                    <div>
                        <section>
                            <Legend label={i18nKey("proposal.maker.achievementName")} required />
                            <Input
                                autofocus
                                disabled={busy}
                                invalid={achivementName.length > 0 && !achievementNameValid}
                                bind:value={achivementName}
                                minlength={MIN_ACHIEVEMENT_NAME_LENGTH}
                                maxlength={MAX_ACHIEVEMENT_NAME_LENGTH}
                                countdown
                                placeholder={i18nKey("proposal.maker.enterAchievementName")} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.achievementUrl")} required />
                            <Input
                                disabled={busy}
                                minlength={1}
                                maxlength={100}
                                bind:value={achievementUrl}
                                countdown
                                placeholder={i18nKey("https://myapp.xyz/register")} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.achievementLogo")} />
                            <Input
                                disabled={busy}
                                invalid={!isLogoValid(tokenLogo)}
                                minlength={0}
                                maxlength={50000}
                                bind:value={tokenLogo}
                                countdown
                                placeholder={i18nKey("data:image/svg+xml;base64,PHN2ZyB3aW...")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.awardingAchievementCanisterId")}
                                rules={i18nKey("proposal.maker.awardingAchievementCanisterIdRules")}
                                required />
                            <Input
                                autofocus
                                disabled={busy}
                                invalid={awardingAchievementCanisterId.length > 0 &&
                                    !isPrincipalValid(awardingAchievementCanisterId)}
                                bind:value={awardingAchievementCanisterId}
                                minlength={CANISTER_ID_LENGTH}
                                maxlength={CANISTER_ID_LENGTH}
                                countdown
                                placeholder={i18nKey("2ouva-viaaa-aaaaq-aaamq-cai")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.chitReward")}
                                rules={i18nKey("proposal.maker.chitRewardRules", {
                                    value: MIN_CHIT_REWARD,
                                })}
                                required />
                            <Input
                                disabled={busy}
                                invalid={chitRewardText.length > 0 && !chitRewardValid}
                                minlength={4}
                                maxlength={5}
                                bind:value={chitRewardText}
                                placeholder={i18nKey("proposal.maker.enterChitReward")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.maxAwards")}
                                rules={i18nKey("proposal.maker.maxAwardsRules", {
                                    value: MIN_AWARDS,
                                })}
                                required />
                            <Input
                                disabled={busy}
                                invalid={maxAwardsText.length > 0 && !maxAwardsValid}
                                minlength={3}
                                maxlength={8}
                                bind:value={maxAwardsText}
                                placeholder={i18nKey("proposal.maker.enterMaxAwards")} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.achievementExpiry")} required />

                            <DurationPicker
                                bind:valid={achievementExpiryValid}
                                bind:milliseconds={achievementExpiry}
                                unitFilter={(u) => !["minutes", "hours"].includes(u)} />
                        </section>
                    </div>
                {:else if selectedProposalType === "add_token" || selectedProposalType === "update_token"}
                    <div>
                        <section>
                            <Legend label={i18nKey("proposal.maker.ledgerCanisterId")} required />
                            <Input
                                autofocus
                                disabled={busy}
                                invalid={addOrUpdateTokenLedgerCanisterId.length > 0 &&
                                    !isPrincipalValid(addOrUpdateTokenLedgerCanisterId)}
                                bind:value={addOrUpdateTokenLedgerCanisterId}
                                minlength={CANISTER_ID_LENGTH}
                                maxlength={CANISTER_ID_LENGTH}
                                countdown
                                placeholder={i18nKey("2ouva-viaaa-aaaaq-aaamq-cai")} />
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
                                placeholder={i18nKey("https://token.com/info")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.howToBuyUrl")}
                                required={selectedProposalType === "add_token"} />
                            <Input
                                disabled={busy}
                                minlength={1}
                                maxlength={100}
                                bind:value={addOrUpdateTokenHowToBuyUrl}
                                countdown
                                placeholder={i18nKey("https://token.com/how-to-buy")} />
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
                                placeholder={i18nKey(
                                    `https://token.com/transactions/{transaction_index}`,
                                )} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.tokenLogo")} />
                            <Input
                                disabled={busy}
                                invalid={!isLogoValid(tokenLogo)}
                                minlength={0}
                                maxlength={50000}
                                bind:value={tokenLogo}
                                countdown
                                placeholder={i18nKey("data:image/svg+xml;base64,PHN2ZyB3aW...")} />
                        </section>
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        {#if selectedProposalType === "register_external_acievement" && step === 2}
            <p class="message" class:error={insufficientFundsForAchievement}>
                <Translatable
                    resourceKey={i18nKey("proposal.maker.achievementChatCost", {
                        cost: client.formatTokens(achievementChatCost, 8),
                        token: symbol,
                    })} />
            </p>
        {/if}
        {#if fundingMessage !== undefined}
            <p class="message" class:error={fundingError}>
                <Translatable resourceKey={fundingMessage} />
            </p>
        {/if}
        {#if errorMessage !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            </div>
        {/if}
        <div class="group-buttons">
            <div class="back">
                {#if step > 1 || (step == 1 && insufficientFunds)}
                    <Button
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step - 1)}
                        ><Translatable resourceKey={i18nKey("group.back")} /></Button>
                {/if}
            </div>
            <div class="actions">
                <Button
                    disabled={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={onClose}
                    secondary>{$_("cancel")}</Button>

                <Button
                    disabled={busy || (canSubmit && !valid)}
                    loading={busy || refreshingBalance}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={onClickPrimary}
                    ><Translatable
                        resourceKey={i18nKey(
                            step === 0 ? "refresh" : canSubmit ? "submit" : "group.next",
                        )} /></Button>
            </div>
        </div>
    </span>
</ModalContent>

<style lang="scss">
    :global(.group-buttons button:not(.loading)) {
        @include mobile() {
            min-width: 0 !important;
        }
    }

    :global(.group-buttons .actions button) {
        height: auto;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;
    }

    .footer {
        text-align: left;
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

    .body {
        width: 100%;
        padding: $sp3 $sp5 $sp2 $sp5;

        @include mobile() {
            padding: $sp3 $sp4 $sp2 $sp4;
        }

        overflow: hidden;
        position: relative;
    }

    .sections {
        display: flex;
        transition: left 250ms ease-in-out;
        position: relative;
        gap: $sp5;
        height: 100%;
        @include mobile() {
            gap: $sp4;
        }
    }

    section.type {
        margin-bottom: $sp3;
    }

    .topup,
    .common,
    .action {
        flex: 0 0 100%;
        gap: $sp2;
        display: flex;
        flex-direction: column;
        transition: visibility 250ms ease-in-out;
    }

    .hidden {
        visibility: hidden;
        &.visible {
            visibility: visible;
        }
    }

    .summary-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .preview {
        cursor: pointer;
        color: var(--txt-light);
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;

        .text {
            text-transform: lowercase;
            text-decoration: underline;
            @include font(light, normal, fs-60);
        }
    }

    .markdown {
        margin-bottom: $sp2;
        @include input(normal);
        @include nice-scrollbar();
    }

    .message {
        margin-bottom: $sp4;
        color: var(--txt-light);
        &.error {
            color: var(--error);
        }
    }
</style>
