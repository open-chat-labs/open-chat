<script lang="ts">
    import BotPublisher from "@src/components/bots/BotPublisher.svelte";
    import {
        formatTokens,
        iconSize,
        mobileWidth,
        type MultiUserChat,
        type NervousSystemDetails,
        type OpenChat,
    } from "@client";
    import { isPrincipalValid } from "@shared";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import EyeIcon from "svelte-material-icons/EyeOutline.svelte";
    import PencilIcon from "svelte-material-icons/PencilOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
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
    } from "@src/logic/proposal/proposalForm.svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Select from "../../Select.svelte";
    import TextArea from "../../TextArea.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import DurationPicker from "../DurationPicker.svelte";
    import Markdown from "@src/core/Markdown.svelte";
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
    let actualWidth = $state(0);
    let balanceWithRefresh: BalanceWithRefresh;
    let summaryPreview = $state(false);
    let summaryContainerHeight = $state(0);
    let summaryHeight = $state(0);

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
</script>

<ModalContent bind:actualWidth fill>
    {#snippet header()}
        <div class="header">
            {$_("proposal.maker.header")}
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                ledger={form.ledger}
                value={form.balance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                onClick={() => form.balanceRefreshStarted()}
                onRefreshed={() => form.balanceRefreshed()}
                onError={() => form.balanceRefreshFailed()} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <div class="sections">
                <div class="topup hidden" class:visible={form.step === "deposit"}>
                    <AccountInfo ledger={form.ledger} />
                    <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                </div>
                <div class="common hidden" class:visible={form.step === "details"}>
                    <section class="type">
                        <Legend label={i18nKey("proposal.maker.type")} required />
                        <Select bind:value={form.type} margin={false}>
                            <option value={undefined} disabled selected
                                ><Translatable
                                    resourceKey={i18nKey("proposal.maker.selectType")} /></option>
                            <option value={"motion"}>Motion</option>
                            <option value={"transfer_sns_funds"}>Transfer SNS funds</option>
                            <option value={"advance_sns_target_version"}
                                >Advance SNS target version</option>
                            {#if symbol === "CHAT"}
                                <option value={"register_external_achievement"}
                                    >Register external achievement</option>
                                <option value={"add_token"}>Add token</option>
                                <option value={"update_token"}>Update token</option>
                                <option value={"publish_bot"}>Publish a bot</option>
                                <option value={"remove_bot"}>
                                    <Translatable resourceKey={i18nKey("bots.manage.remove")}
                                    ></Translatable>
                                </option>
                                <option value={"set_community_verification"}>
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "verified.verify",
                                            undefined,
                                            "community",
                                            true,
                                        )}></Translatable>
                                </option>
                                <option value={"set_group_verification"}>
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "verified.verify",
                                            undefined,
                                            "group",
                                            true,
                                        )}></Translatable>
                                </option>
                                <option value={"revoke_community_verification"}>
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "verified.revoke",
                                            undefined,
                                            "community",
                                            true,
                                        )}></Translatable>
                                </option>
                                <option value={"revoke_group_verification"}>
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "verified.revoke",
                                            undefined,
                                            "group",
                                            true,
                                        )}></Translatable>
                                </option>
                            {/if}
                        </Select>
                    </section>
                    <section>
                        <Legend label={i18nKey("proposal.maker.title")} required />
                        <Input
                            autofocus
                            disabled={form.busy}
                            invalid={form.title.length > 0 && !form.titleValid}
                            bind:value={form.title}
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
                            disabled={form.busy}
                            invalid={!form.urlValid}
                            bind:value={form.url}
                            maxlength={MAX_URL_LENGTH}
                            countdown
                            placeholder={i18nKey("proposal.maker.enterUrl")} />
                    </section>
                    <section>
                        <div class="summary-heading">
                            <Legend
                                required
                                label={summaryLabel}
                                rules={i18nKey("proposal.maker.summaryRules")} />
                            <div
                                role="switch"
                                tabindex="1"
                                class="preview"
                                onclick={() => (summaryPreview = !summaryPreview)}>
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
                                    <Markdown inline={false} text={form.summaryPreview} />
                                </div>
                            {:else}
                                <TextArea
                                    rows={8}
                                    bind:outerHeight={summaryContainerHeight}
                                    bind:innerHeight={summaryHeight}
                                    disabled={form.busy}
                                    invalid={form.summary.length > 0 && !form.summaryValid}
                                    bind:value={form.summary}
                                    margin={false}
                                    scroll
                                    minlength={MIN_SUMMARY_LENGTH}
                                    maxlength={MAX_SUMMARY_LENGTH}
                                    placeholder={summaryPlaceholder} />
                            {/if}
                        </div>
                    </section>
                </div>
                <div class="action hidden" class:visible={form.step === "action"}>
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
                        <div>
                            <section>
                                <Legend
                                    label={i18nKey("proposal.maker.achievementName")}
                                    required />
                                <Input
                                    autofocus
                                    disabled={form.busy}
                                    invalid={form.achievementName.length > 0 && !form.achievementNameValid}
                                    bind:value={form.achievementName}
                                    minlength={MIN_ACHIEVEMENT_NAME_LENGTH}
                                    maxlength={MAX_ACHIEVEMENT_NAME_LENGTH}
                                    countdown
                                    placeholder={i18nKey("proposal.maker.enterAchievementName")} />
                            </section>
                            <section>
                                <Legend label={i18nKey("proposal.maker.achievementUrl")} required />
                                <Input
                                    disabled={form.busy}
                                    minlength={1}
                                    maxlength={100}
                                    bind:value={form.achievementUrl}
                                    countdown
                                    placeholder={i18nKey("https://myapp.xyz/register")} />
                            </section>
                            <section>
                                <Legend label={i18nKey("proposal.maker.achievementLogo")} />
                                <Input
                                    disabled={form.busy}
                                    invalid={!form.logoValid}
                                    minlength={0}
                                    maxlength={50000}
                                    bind:value={form.achievementLogo}
                                    countdown
                                    placeholder={i18nKey(
                                        "data:image/svg+xml;base64,PHN2ZyB3aW...",
                                    )} />
                            </section>
                            <section>
                                <Legend
                                    label={i18nKey("proposal.maker.awardingAchievementCanisterId")}
                                    rules={i18nKey(
                                        "proposal.maker.awardingAchievementCanisterIdRules",
                                    )}
                                    required />
                                <Input
                                    autofocus
                                    disabled={form.busy}
                                    invalid={form.awardingAchievementCanisterId.length > 0 &&
                                        !isPrincipalValid(form.awardingAchievementCanisterId)}
                                    bind:value={form.awardingAchievementCanisterId}
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
                                    disabled={form.busy}
                                    invalid={form.chitRewardText.length > 0 && !form.chitRewardValid}
                                    minlength={4}
                                    maxlength={5}
                                    bind:value={form.chitRewardText}
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
                                    disabled={form.busy}
                                    invalid={form.maxAwardsText.length > 0 && !form.maxAwardsValid}
                                    minlength={3}
                                    maxlength={8}
                                    bind:value={form.maxAwardsText}
                                    placeholder={i18nKey("proposal.maker.enterMaxAwards")} />
                            </section>
                            <section>
                                <Legend
                                    label={i18nKey("proposal.maker.achievementExpiry")}
                                    required />

                                <DurationPicker
                                    bind:valid={form.achievementExpiryValid}
                                    bind:milliseconds={form.achievementExpiry}
                                    unitFilter={(u) => !["minutes", "hours"].includes(u)} />
                            </section>
                        </div>
                    {:else if form.type === "add_token" || form.type === "update_token"}
                        <div>
                            <section>
                                <Legend
                                    label={i18nKey("proposal.maker.ledgerCanisterId")}
                                    required />
                                <Input
                                    autofocus
                                    disabled={form.busy}
                                    invalid={form.tokenLedgerCanisterId.length > 0 &&
                                        !isPrincipalValid(form.tokenLedgerCanisterId)}
                                    bind:value={form.tokenLedgerCanisterId}
                                    minlength={CANISTER_ID_LENGTH}
                                    maxlength={CANISTER_ID_LENGTH}
                                    countdown
                                    placeholder={i18nKey("2ouva-viaaa-aaaaq-aaamq-cai")} />
                            </section>
                            <section>
                                <Legend
                                    label={i18nKey("proposal.maker.tokenInfoUrl")}
                                    required={form.type === "add_token"} />
                                <Input
                                    disabled={form.busy}
                                    minlength={1}
                                    maxlength={100}
                                    bind:value={form.tokenInfoUrl}
                                    countdown
                                    placeholder={i18nKey("https://token.com/info")} />
                            </section>
                            <section>
                                <Legend
                                    label={i18nKey("proposal.maker.transactionUrlFormat")}
                                    required={form.type === "add_token"} />
                                <Input
                                    disabled={form.busy}
                                    minlength={1}
                                    maxlength={200}
                                    bind:value={form.tokenTransactionUrlFormat}
                                    countdown
                                    placeholder={i18nKey(
                                        `https://token.com/transactions/{transaction_index}`,
                                    )} />
                            </section>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/snippet}
    {#snippet footer()}
        <span class="footer">
            {#if (form.type === "register_external_achievement" || form.type === "add_token") && form.step === "action"}
                <p class="message" class:error={form.insufficientFundsForPayment}>
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
                </p>
            {/if}
            <p class="message" class:error={form.depositError}>
                <Translatable resourceKey={form.depositMessage} />
            </p>
            {#if errorMessage !== undefined}
                <div class="error">
                    <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
                </div>
            {/if}
            <div class="group-buttons">
                <div class="back">
                    {#if form.canGoBack}
                        <Button
                            disabled={form.busy}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}
                            onClick={() => form.back()}
                            ><Translatable resourceKey={i18nKey("group.back")} /></Button>
                    {/if}
                </div>
                <div class="actions">
                    <Button
                        disabled={form.busy}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={onClose}
                        secondary>{$_("cancel")}</Button>

                    <Button
                        disabled={form.busy ||
                            (form.canSubmit && !form.valid) ||
                            form.type === undefined}
                        loading={form.busy || form.refreshingBalance}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}
                        onClick={onClickPrimary}
                        ><Translatable
                            resourceKey={i18nKey(
                                form.step === "deposit" ? "refresh" : form.canSubmit ? "submit" : "group.next",
                            )} /></Button>
                </div>
            </div>
        </span>
    {/snippet}
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
        position: relative;
        gap: $sp5;
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
    }

    .hidden {
        display: none;
        &.visible {
            display: flex;
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
