<script lang="ts">
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { LEDGER_CANISTER_CHAT, type OpenChat, type Treasury } from "openchat-client";
    import { iconSize } from "../../stores/iconSize";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import Input from "../Input.svelte";
    import TextArea from "../TextArea.svelte";
    import Select from "../Select.svelte";
    import Radio from "../Radio.svelte";
    import { OC_GOVERNANCE_CANISTER_ID, isPrincipalValid } from "../../utils/sns";
    import { Principal } from "@dfinity/principal";
    import PencilIcon from "svelte-material-icons/PencilOutline.svelte";
    import EyeIcon from "svelte-material-icons/EyeOutline.svelte";
    import Markdown from "./Markdown.svelte";

    const MIN_TITLE_LENGTH = 3;
    const MAX_TITLE_LENGTH = 120;
    const MAX_URL_LENGTH = 2000;
    const MIN_SUMMARY_LENGTH = 3;
    const MAX_SUMMARY_LENGTH = 7000;
    const MIN_AMOUNT = 1;
    const MAX_AMOUNT = 1000000;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let title = "";
    let url = "";
    let summary = "";
    let treasury: Treasury = "SNS";
    let amount = "";
    let recipient = "";
    let step = 0;
    let actualWidth = 0;
    let summaryPreview = false;
    let busy = false;
    let selectedProposalType: "motion" | "transfer_sns_funds" = "motion";
    let errorMessage: string | undefined = undefined;
    let recipientValid = false;
    let summaryContainerHeight = 0;
    let summaryHeight = 0;

    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[LEDGER_CANISTER_CHAT] ?? BigInt(0);
    $: insufficientFunds = cryptoBalance < BigInt(400200000);
    $: padding = $mobileWidth ? 16 : 24; // yes this is horrible
    $: left = step * (actualWidth - padding);
    $: token = treasury === "SNS" ? "CHAT" : "ICP";
    $: titleValid = title.length >= MIN_TITLE_LENGTH && title.length <= MAX_TITLE_LENGTH;
    $: urlValid = url.length <= MAX_URL_LENGTH;
    $: summaryValid = summary.length >= MIN_SUMMARY_LENGTH && summary.length <= MAX_SUMMARY_LENGTH;
    $: amountValid = isAmountValid(amount);
    $: recipientValid = isPrincipalValid(recipient);
    $: valid =
        !insufficientFunds &&
        titleValid &&
        urlValid &&
        summaryValid &&
        (selectedProposalType === "motion" || (amountValid && recipientValid));

    $: {
        if (insufficientFunds) {
            errorMessage = $_("proposal.maker.insufficientFunds", {
                values: { min_balance: "4.002", token: "CHAT" },
            });
        } else {
            errorMessage = undefined;
        }
    }

    function onClose() {
        dispatch("close");
    }

    function isAmountValid(value: string): boolean {
        const amount = Number(value);
        return amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
    }

    function onSubmit() {
        if (!valid) return;

        busy = true;

        const action =
            selectedProposalType === "motion"
                ? { kind: selectedProposalType }
                : {
                      kind: selectedProposalType,
                      to: Principal.fromText(recipient),
                      amount: BigInt(amount),
                      treasury,
                  };

        client
            .submitProposal(OC_GOVERNANCE_CANISTER_ID, {
                title,
                url: url === "" ? undefined : url,
                summary,
                action,
            })
            .then((success) => {
                busy = false;
                errorMessage = success ? undefined : $_("proposal.maker.unexpectedError");
                if (success) {
                    dispatch("close");
                }
            });
    }
</script>

<ModalContent bind:actualWidth closeIcon fill on:close>
    <div class="header" slot="header">{$_("proposal.maker.header")}</div>
    <div class="body" slot="body">
        <div class="sections" style={`left: -${left}px`}>
            <div class="common" class:visible={step === 0}>
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
                                <Markdown inline={false} text={summary} />
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
            <div class="transfer" class:visible={step === 1}>
                {#if selectedProposalType === "transfer_sns_funds"}
                    <section>
                        <Legend label={$_("proposal.maker.treasury")} required />
                        <Radio
                            id="chat_treasury"
                            group="treasury"
                            value="CHAT"
                            label="CHAT"
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
                            invalid={amount.length > 0 && !amountValid}
                            minlength={1}
                            maxlength={12}
                            bind:value={amount}
                            countdown
                            placeholder={$_("proposal.maker.enterAmount", { values: { token } })} />
                    </section>
                {/if}
                <section>
                    <Legend label={$_("proposal.maker.infoLegend")} />
                    <p class="info">
                        {$_("proposal.maker.info", { values: { token: "CHAT" } })}
                    </p>
                </section>
            </div>
        </div>
    </div>
    <span class="footer" slot="footer">
        {#if errorMessage !== undefined}
            <p class="error">{errorMessage}</p>
        {/if}
        <div class="group-buttons">
            <div class="back">
                {#if step > 0}
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

                {#if step == 1}
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={onSubmit}>{$_("submit")}</Button>
                {:else}
                    <Button
                        disabled={busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        on:click={() => (step = step + 1)}>
                        {$_("group.next")}
                    </Button>
                {/if}
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

    .common,
    .transfer {
        flex: 0 0 100%;
        gap: $sp2;
        display: flex;
        flex-direction: column;
        visibility: hidden;
        transition: visibility 250ms ease-in-out;

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

    .info {
        @include input(normal);
        color: var(--txt-light);
    }

    .error {
        color: var(--error);
        margin-bottom: $sp4;
    }
</style>
