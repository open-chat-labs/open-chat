<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import {
        routeForChatIdentifier,
        type MultiUserChat,
        type OpenChat,
        type Treasury,
    } from "openchat-client";
    import { iconSize } from "../../stores/iconSize";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import Input from "../Input.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import Radio from "../Radio.svelte";
    import { isPrincipalValid } from "../../utils/sns";
    import PencilIcon from "svelte-material-icons/PencilOutline.svelte";
    import EyeIcon from "svelte-material-icons/EyeOutline.svelte";
    import Markdown from "./Markdown.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import AccountInfo from "./AccountInfo.svelte";

    const MIN_TITLE_LENGTH = 3;
    const MAX_TITLE_LENGTH = 120;
    const MAX_URL_LENGTH = 2000;
    const MIN_SUMMARY_LENGTH = 3;
    const MAX_SUMMARY_LENGTH = 5000;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const user = client.user;
    const proposalCost = BigInt(400000000);

    export let selectedMultiUserChat: MultiUserChat;
    export let governanceCanisterId: string;

    let title = "";
    let url = "";
    let summary = "";
    let treasury: Treasury = "SNS";
    let amountText = "";
    let recipient = "";
    let step = -1;
    let actualWidth = 0;
    let summaryPreview = false;
    let busy = true;
    let selectedProposalType: "motion" | "transfer_sns_funds" = "motion";
    let message = "";
    let error = true;
    let recipientValid = false;
    let summaryContainerHeight = 0;
    let summaryHeight = 0;
    let refreshingBalance = false;
    let balanceWithRefresh: BalanceWithRefresh;

    $: tokenDetails = client.getTokenByGovernanceCanister(governanceCanisterId);
    $: ledger = tokenDetails.ledger;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFee = tokenDetails.transferFee;
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
    $: recipientValid = isPrincipalValid(recipient);
    $: valid =
        !insufficientFunds &&
        titleValid &&
        urlValid &&
        summaryValid &&
        (selectedProposalType === "motion" || (amountValid && recipientValid));
    $: canSubmit = step === 2 || (step === 1 && selectedProposalType === "motion");

    $: {
        if (tokenDetails !== undefined) {
            message = defaultMessage();
        }
    }

    function defaultMessage(): string {
        const cost = client.formatTokens(requiredFunds, 0, tokenDetails.decimals);
        return $_("proposal.maker.message", { values: { cost, token: symbol } });
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

        const action =
            selectedProposalType === "motion"
                ? { kind: selectedProposalType }
                : {
                      kind: selectedProposalType,
                      toPrincipal: recipient,
                      amount: BigInt(Math.floor(amount)),
                      treasury,
                  };

        client
            .submitProposal(governanceCanisterId, {
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
                    message = $_("proposal.maker.unexpectedError");
                }
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
                error = false;
            }
        } else if (step === 0 && !insufficientFunds) {
            step = 1;
            error = false;
        }

        refreshingBalance = false;
    }

    function onRefreshingBalanceFailed() {
        message = "Failed to refresh balance";
        error = true;
        refreshingBalance = false;
    }

    function wrappedSummary(summary: string) {
        const groupPath = routeForChatIdentifier(
            selectedMultiUserChat.kind === "group_chat" ? "group_chat" : "community",
            selectedMultiUserChat.id
        );

        return `${summary}

> Submitted by [@${user.username}](https://oc.app/user/${user.userId}) on [OpenChat](https://oc.app${groupPath})`;
    }
</script>

<ModalContent bind:actualWidth fill>
    <div class="header" slot="header">
        {$_("proposal.maker.header")}
        <BalanceWithRefresh
            bind:this={balanceWithRefresh}
            {ledger}
            value={cryptoBalance}
            label={$_("cryptoAccount.shortBalanceLabel")}
            bold
            on:click={onStartRefreshingBalance}
            on:refreshed={onRefreshingBalanceSuccess}
            on:error={onRefreshingBalanceFailed} />
    </div>
    <div class="body" slot="body">
        <div class="sections" style={`left: -${left}px`}>
            <div class="topup hidden" class:visible={step === 0}>
                <AccountInfo {ledger} {user} />
                <p>{$_("tokenTransfer.makeDeposit")}</p>
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol } })}
                </a>
            </div>
            <div class="common hidden" class:visible={step === 1}>
                <section class="type">
                    <Legend label={$_("proposal.maker.type")} />
                    <Select bind:value={selectedProposalType} margin={false}>
                        <option value={"motion"}>Motion</option>
                        <option value={"transfer_sns_funds"}>Transfer SNS funds</option>
                    </Select>
                </section>
                <section>
                    <Legend label={$_("proposal.maker.title")} required />
                    <Input
                        autofocus
                        disabled={busy}
                        invalid={title.length > 0 && !titleValid}
                        bind:value={title}
                        minlength={MIN_TITLE_LENGTH}
                        maxlength={MAX_TITLE_LENGTH}
                        countdown
                        placeholder={$_("proposal.maker.enterTitle")} />
                </section>
                <section>
                    <Legend
                        label={$_("proposal.maker.url")}
                        rules={$_("proposal.maker.urlRules")} />
                    <Input
                        disabled={busy}
                        invalid={!urlValid}
                        bind:value={url}
                        maxlength={MAX_URL_LENGTH}
                        countdown
                        placeholder={$_("proposal.maker.enterUrl")} />
                </section>
                <section>
                    <div class="summary-heading">
                        <Legend
                            required
                            label={$_("proposal.maker.summary")}
                            rules={$_("proposal.maker.summaryRules")} />
                        <div
                            role="switch"
                            tabindex="1"
                            class="preview"
                            on:click={() => (summaryPreview = !summaryPreview)}>
                            <span class="text">{$_(summaryPreview ? "edit" : "preview")}</span>
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
                                placeholder={$_("proposal.maker.enterSummary")} />
                        {/if}
                    </div>
                </section>
            </div>
            <div class="action hidden" class:visible={step === 2}>
                <div class="hidden" class:visible={selectedProposalType === "transfer_sns_funds"}>
                    <section>
                        <Legend label={$_("proposal.maker.treasury")} required />
                        <Radio
                            id="chat_treasury"
                            group="treasury"
                            value={symbol}
                            label={symbol}
                            disabled={busy}
                            checked={treasury === "SNS"}
                            on:change={() => (treasury = "SNS")} />
                        <Radio
                            id="icp_treasury"
                            group="treasury"
                            value="ICP"
                            label="ICP"
                            disabled={busy}
                            checked={treasury === "ICP"}
                            on:change={() => (treasury = "ICP")} />
                    </section>
                    <section>
                        <Legend label={$_("proposal.maker.toPrincipal")} required />
                        <Input
                            disabled={busy}
                            invalid={recipient.length > 0 && !recipientValid}
                            bind:value={recipient}
                            minlength={MIN_TITLE_LENGTH}
                            maxlength={MAX_TITLE_LENGTH}
                            countdown
                            placeholder={$_("proposal.maker.enterToPrincipal")} />
                    </section>
                    <section>
                        <Legend
                            label={$_("proposal.maker.amount")}
                            rules={$_("proposal.maker.amountRules", { values: { token } })}
                            required />
                        <Input
                            disabled={busy}
                            invalid={amountText.length > 0 && !amountValid}
                            minlength={1}
                            maxlength={20}
                            bind:value={amountText}
                            placeholder={$_("proposal.maker.enterAmount", {
                                values: { token },
                            })} />
                    </section>
                </div>
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        <p class="message" class:error>{message}</p>
        <div class="group-buttons">
            <div class="back">
                {#if step > 1 || (step == 1 && insufficientFunds)}
                    <Button
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step - 1)}>{$_("group.back")}</Button>
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
                    >{$_(step === 0 ? "refresh" : canSubmit ? "submit" : "group.next")}</Button>
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
