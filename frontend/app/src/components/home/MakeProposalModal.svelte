<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import {
        routeForChatIdentifier,
        type CandidateProposalAction,
        type MultiUserChat,
        type NervousSystemDetails,
        type OpenChat,
        type Treasury,
    } from "openchat-client";
    import { isPrincipalValid, isSubAccountValid, isUrl } from "openchat-shared";
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
    import { createAddTokenPayload } from "../../utils/sns";
    import { i18nKey, type ResourceKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const MIN_TITLE_LENGTH = 3;
    const MAX_TITLE_LENGTH = 120;
    const MAX_URL_LENGTH = 2000;
    const MIN_SUMMARY_LENGTH = 3;
    const MAX_SUMMARY_LENGTH = 5000;
    const CANISTER_ID_LENGTH = 27;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let selectedMultiUserChat: MultiUserChat;
    export let nervousSystem: NervousSystemDetails;

    let title = "";
    let url = "";
    let summary = "";
    let treasury: Treasury = "SNS";
    let amountText = "";
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
        | "add_token" = "motion";
    let message: ResourceKey | undefined = undefined;
    let error = true;
    let summaryContainerHeight = 0;
    let summaryHeight = 0;
    let refreshingBalance = false;
    let balanceWithRefresh: BalanceWithRefresh;

    $: user = client.user;
    $: tokenDetails = nervousSystem.token;
    $: ledger = tokenDetails.ledger;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFee = tokenDetails.transferFee;
    $: proposalCost = nervousSystem.proposalRejectionFee;
    $: requiredFunds = proposalCost + transferFee + transferFee;
    $: insufficientFunds = cryptoBalance < requiredFunds;
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: token = treasury === "SNS" ? symbol : "ICP";
    $: titleValid = title.length >= MIN_TITLE_LENGTH && title.length <= MAX_TITLE_LENGTH;
    $: urlValid = url.length <= MAX_URL_LENGTH;
    $: summaryValid = summary.length >= MIN_SUMMARY_LENGTH && summary.length <= MAX_SUMMARY_LENGTH;
    $: amount = Number(amountText) * Number(Math.pow(10, tokenDetails.decimals));
    $: amountValid = amount >= transferFee;
    $: recipientOwnerValid = isPrincipalValid(recipientOwner);
    $: recipientSubaccountValid =
        recipientSubaccount.length === 0 || isSubAccountValid(recipientSubaccount);
    $: addTokenLedgerCanisterId = "";
    $: addTokenHowToBuyUrl = "";
    $: addTokenInfoUrl = "";
    $: addTokenTransactionUrlFormat = "";
    $: addTokenLogo = "";
    $: valid =
        !insufficientFunds &&
        titleValid &&
        urlValid &&
        summaryValid &&
        (selectedProposalType === "motion" ||
            selectedProposalType === "upgrade_sns_to_next_version" ||
            (selectedProposalType === "transfer_sns_funds" &&
                amountValid &&
                recipientOwnerValid &&
                recipientSubaccountValid) ||
            (selectedProposalType === "add_token" &&
                isPrincipalValid(addTokenLedgerCanisterId) &&
                addTokenHowToBuyUrl.length > 0 &&
                addTokenTransactionUrlFormat.length > 0 &&
                isTokenLogoValid(addTokenLogo)));
    $: canSubmit =
        step === 2 ||
        (step === 1 &&
            (selectedProposalType === "motion" ||
                selectedProposalType === "upgrade_sns_to_next_version"));

    $: {
        if (tokenDetails !== undefined) {
            message = defaultMessage();
        }
    }

    function defaultMessage(): ResourceKey {
        const cost = client.formatTokens(requiredFunds, tokenDetails.decimals);
        return i18nKey("proposal.maker.message", { cost, token: symbol });
    }

    function onClose() {
        dispatch("close");
    }

    function onClickPrimary() {
        if (step === 0) {
            balanceWithRefresh.refresh();
        } else if (canSubmit) {
            onSubmit();
        } else if (step === 1) {
            step = 2;
        }
    }

    function onSubmit() {
        if (!valid) return;

        busy = true;

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
                error = !success;
                if (success) {
                    dispatch("close");
                } else {
                    message = i18nKey("proposal.maker.unexpectedError");
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
                        addTokenLedgerCanisterId,
                        addTokenInfoUrl,
                        addTokenHowToBuyUrl,
                        addTokenTransactionUrlFormat,
                        addTokenLogo,
                    ),
                };
            }
        }
    }

    function onStartRefreshingBalance() {
        refreshingBalance = true;
    }

    function onRefreshingBalanceSuccess() {
        if (step === -1) {
            step = insufficientFunds ? 0 : 1;
            busy = false;
            if (!insufficientFunds) {
                error = false;
            }
        } else if (step === 0 && !insufficientFunds) {
            step = 1;
            error = false;
        }

        refreshingBalance = false;
    }

    function onRefreshingBalanceFailed() {
        message = i18nKey("Failed to refresh balance");
        error = true;
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

    function isTokenLogoValid(logo: string): boolean {
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
                            <option value={"add_token"}>Add token</option>
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
                {:else if selectedProposalType === "add_token"}
                    <div>
                        <section>
                            <Legend label={i18nKey("proposal.maker.ledgerCanisterId")} required />
                            <Input
                                autofocus
                                disabled={busy}
                                invalid={addTokenLedgerCanisterId.length > 0 &&
                                    !isPrincipalValid(addTokenLedgerCanisterId)}
                                bind:value={addTokenLedgerCanisterId}
                                minlength={CANISTER_ID_LENGTH}
                                maxlength={CANISTER_ID_LENGTH}
                                countdown
                                placeholder={i18nKey("2ouva-viaaa-aaaaq-aaamq-cai")} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.tokenInfoUrl")} required />
                            <Input
                                disabled={busy}
                                minlength={1}
                                maxlength={100}
                                bind:value={addTokenInfoUrl}
                                countdown
                                placeholder={i18nKey("https://token.com/info")} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.howToBuyUrl")} required />
                            <Input
                                disabled={busy}
                                minlength={1}
                                maxlength={100}
                                bind:value={addTokenHowToBuyUrl}
                                countdown
                                placeholder={i18nKey("https://token.com/how-to-buy")} />
                        </section>
                        <section>
                            <Legend
                                label={i18nKey("proposal.maker.transactionUrlFormat")}
                                required />
                            <Input
                                disabled={busy}
                                minlength={1}
                                maxlength={100}
                                bind:value={addTokenTransactionUrlFormat}
                                countdown
                                placeholder={i18nKey(
                                    `https://token.com/transactions/{transaction_index}`,
                                )} />
                        </section>
                        <section>
                            <Legend label={i18nKey("proposal.maker.tokenLogo")} />
                            <Input
                                disabled={busy}
                                invalid={!isTokenLogoValid(addTokenLogo)}
                                minlength={0}
                                maxlength={10000}
                                bind:value={addTokenLogo}
                                countdown
                                placeholder={i18nKey("data:image/svg+xml;base64,PHN2ZyB3aW...")} />
                        </section>
                    </div>
                {/if}
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        {#if message !== undefined}
            <p class="message" class:error><Translatable resourceKey={message} /></p>
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
