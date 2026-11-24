<!-- Send (native design notes §3.9 Flows; the plan's 13), in two steps. 1: the token (its sheet:
     the tokens held, opening by itself when Send starts from the wallet), who it goes to (the
     recipient sheet), the amount with its value and quick picks, a message for a person's chat,
     and the fee and total; the pinned button says exactly what it sends, or what's missing. 2: the
     PIN (the client asks, through the shell's PIN sheet, with the chip saying what it confirms),
     then the receipt, "Sending…" then sent, with View in chat for a person and Done, which lands
     on the token's page. The send is the web's (logic/wallet/walletSendFlow: to a person a
     transfer in their DM, to an address a withdrawal, over Bitcoin's own network for BTC to a
     Bitcoin address, with the ckBTC minter's fee on top); its amounts are exact ledger units (6b
     invariants). A dismissed PIN goes back to the form; a failure says why in a toast. -->
<script lang="ts">
    import {
        allUsersStore,
        BTC_SYMBOL,
        currentUserIdStore,
        currentUserStore,
        directChatUsers,
        enhancedCryptoLookup,
        formatTokens,
        LEDGER_CANISTER_CKSOL,
        LEDGER_CANISTER_ICP,
        namedAccountsStore,
        pinNumberFailureStore,
        pinNumberResolverStore,
        routeForChatIdentifier,
        serverDirectChatsStore,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import { swatchFor } from "@src/logic/swatch";
    import { BtcWithdrawalFees } from "@src/logic/wallet/btcWithdrawalFees.svelte";
    import { sendContacts, walletRecipients } from "@src/logic/wallet/walletFlows";
    import { sendFromWallet, walletAddressCheck } from "@src/logic/wallet/walletSendFlow";
    import { pinNumberErrorMessage } from "@src/stores/pinNumber";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { aboveKeyboard } from "../../aboveKeyboard.svelte";
    import { useOverlay } from "../../shell/overlays.svelte";
    import { pinAction } from "../../shell/pinAction.svelte";
    import type { ScreenContext } from "../app/screens";
    import FlowPicker from "./FlowPicker.svelte";
    import FlowResult from "./FlowResult.svelte";
    import {
        cleanAmount,
        displayValue,
        quickAmount,
        sendAvailable,
        sendCheck,
        sendNetwork,
        sendRoute,
        shortAddress,
        tokenFace,
        type FlowToken,
        type QuickPick,
        type SendTo,
    } from "./flows.adapter";
    import QuickPicks from "./QuickPicks.svelte";
    import RecipientSheet from "./RecipientSheet.svelte";
    import SummaryRows, { type SummaryRow } from "./SummaryRows.svelte";
    import SupportedTokensSheet from "./SupportedTokensSheet.svelte";
    import { tokenUrl, type WalletFigures } from "./wallet.adapter";

    type Props = { ledger: string | undefined; context: ScreenContext; figures: WalletFigures };

    let { ledger, context, figures }: Props = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    onMount(() => client.loadSavedCryptoAccounts());

    // ---- the form

    let chosen = $state(untrack(() => ledger));
    let to = $state<SendTo>();
    let amountText = $state("");
    // Max picked: what's left after the fee, exactly, whatever the field shows
    let max = $state(false);
    let memo = $state("");

    const face = $derived(tokenFace(figures, chosen));
    const details = $derived(chosen === undefined ? undefined : $enhancedCryptoLookup.get(chosen));
    const token = $derived.by((): FlowToken | undefined =>
        details === undefined
            ? undefined
            : {
                  symbol: details.symbol,
                  decimals: details.decimals,
                  transferFee: details.transferFee,
                  balance: details.balance,
              },
    );

    // a Bitcoin send's minter fee and minimum, while BTC is the token
    const btcFees = new BtcWithdrawalFees((amount) => client.getCkbtcMinterWithdrawalInfo(amount));
    const sendingBtc = $derived(details?.symbol === BTC_SYMBOL);
    $effect(() => {
        if (!sendingBtc) return;
        untrack(() => btcFees.start());
        return () => btcFees.stop();
    });

    const check = $derived(sendCheck({ token, to, amountText, max, btc: btcFees.current }));
    const route = $derived(token === undefined || to === undefined ? undefined : sendRoute(token.symbol, to));

    const amountOf = (units: bigint) =>
        token === undefined ? "" : `${formatTokens(units, token.decimals)} ${token.symbol}`;

    // the amount's line: its value, or what's wrong with it
    const note = $derived.by((): { text: string; warn: boolean } => {
        if (face === undefined || token === undefined) {
            return { text: $_("native.walletFlows.chooseTokenFirst"), warn: false };
        }
        switch (check.cta.kind) {
            case "over_balance":
                return { text: $_("native.walletFlows.overBalance"), warn: true };
            case "too_small":
                return {
                    text: $_("native.walletFlows.atLeast", { values: { amount: amountOf(check.cta.minimum) } }),
                    warn: true,
                };
            default: {
                const units = check.cta.kind === "send" ? check.cta.amount : 0n;
                const value = (Number(units) / 10 ** token.decimals) * face.price;
                return { text: `≈ ${displayValue(figures, value)}`, warn: false };
            }
        }
    });

    const toName = $derived(
        to === undefined
            ? ""
            : to.kind === "person"
              ? to.name
              : (to.name ?? $_("native.walletFlows.anAddress")),
    );

    const cta = $derived.by((): string => {
        switch (check.cta.kind) {
            case "choose_token":
                return $_("native.walletFlows.chooseToken");
            case "choose_recipient":
                return $_("native.walletFlows.chooseRecipient");
            case "enter_amount":
                return $_("native.walletFlows.enterAmount");
            case "over_balance":
                return $_("native.walletFlows.notEnough", { values: { symbol: token?.symbol ?? "" } });
            case "too_small":
                return $_("native.walletFlows.atLeast", { values: { amount: amountOf(check.cta.minimum) } });
            case "waiting_fee":
                return $_("native.walletFlows.gettingFee");
            case "send":
                return to?.kind === "address" && to.name === undefined
                    ? $_("native.walletFlows.sendToAnAddress", { values: { amount: amountOf(check.cta.amount) } })
                    : $_("native.walletFlows.sendToName", {
                          values: { amount: amountOf(check.cta.amount), name: toName },
                      });
        }
    });

    const rows = $derived.by((): SummaryRow[] => [
        {
            label: $_("native.walletFlows.networkFee"),
            value: check.fee === undefined ? "—" : amountOf(check.fee),
        },
        {
            label: $_("native.walletFlows.total"),
            value: check.total === undefined ? "—" : amountOf(check.total),
            warn: check.cta.kind === "over_balance",
        },
    ]);

    function typed(e: Event & { currentTarget: HTMLInputElement }) {
        const clean = cleanAmount(e.currentTarget.value, token?.decimals ?? 8);
        if (e.currentTarget.value !== clean) e.currentTarget.value = clean;
        amountText = clean;
        max = false;
    }

    function quick(pick: QuickPick) {
        if (token === undefined || route === undefined) return;
        if (route === "btc" && btcFees.current === undefined) return;
        amountText = quickAmount(sendAvailable(token, route, btcFees.current), pick, token.decimals);
        max = pick === 100;
    }

    // ---- the sheets: the token (opening by itself from the wallet) and who it goes to

    let sheet = $state<"token" | "recipient" | undefined>();
    useOverlay(
        overlays,
        () => sheet !== undefined,
        () => (sheet = undefined),
    );
    let asking: ReturnType<typeof setTimeout> | undefined;
    onMount(() => {
        if (chosen === undefined) asking = setTimeout(() => (sheet = "token"), 380);
    });
    onDestroy(() => clearTimeout(asking));

    const checkAddress = $derived(
        walletAddressCheck(
            {
                cryptoAccount: $currentUserStore.cryptoAccount,
                userId: $currentUserIdStore,
                principal: () => client.OcIdentityPrincipal,
            },
            (a) => client.isAccountOfMultiUserCanisterUserId(a),
        ),
    );
    const takesAddress = (address: string) =>
        token !== undefined && checkAddress(address, token.symbol);

    const contacts = $derived(sendContacts(directChatUsers($serverDirectChatsStore, $allUsersStore)));
    const btcLedger = $derived(
        [...$enhancedCryptoLookup.values()].find((t) => t.symbol === BTC_SYMBOL)?.ledger,
    );
    const saved = $derived(
        token === undefined
            ? []
            : walletRecipients($namedAccountsStore, {
                  icp: LEDGER_CANISTER_ICP,
                  btc: btcLedger,
                  sol: $enhancedCryptoLookup.has(LEDGER_CANISTER_CKSOL) ? LEDGER_CANISTER_CKSOL : undefined,
              }).filter((r) => takesAddress(r.address)),
    );

    function pickToken(id: string) {
        sheet = undefined;
        if (id === chosen) return;
        chosen = id;
        amountText = "";
        max = false;
        // an address the new token can't reach is dropped
        const details = $enhancedCryptoLookup.get(id);
        if (to?.kind === "address" && (details === undefined || !checkAddress(to.address, details.symbol))) {
            to = undefined;
        }
    }

    function pickRecipient(next: SendTo) {
        sheet = undefined;
        to = next;
        max = false;
    }

    // ---- sending

    type Step = "form" | "sending" | "sent";
    let step = $state<Step>("form");
    let busy = $state(false);
    // the receipt's figures, as they were sent
    let receipt = $state<{ amount: string; fee: string; to: string; memo: string; person: boolean }>();

    const failure = (reason: ResourceKey | "pin"): string => {
        const key = reason === "pin" ? pinNumberErrorMessage(pinNumberFailureStore.value) : reason;
        return key === undefined ? $_("native.walletFlows.sendFailed") : interpolateNewUi($_, key);
    };

    async function send() {
        const cta = check.cta;
        if (busy || cta.kind !== "send" || details === undefined || to === undefined || route === undefined || face === undefined) {
            return;
        }
        const recipient = to;
        const amount = amountOf(cta.amount);
        const person = recipient.kind === "person";
        receipt = {
            amount,
            fee: check.fee === undefined ? "" : amountOf(check.fee),
            to: person ? recipient.name : (recipient.name ?? shortAddress(recipient.address)),
            memo: person ? memo.trim() : "",
            person,
        };
        busy = true;
        step = "sending";
        // a withdrawal refused for its PIN fails like any other (the client's withdrawResult), but
        // the client records why: a new PIN failure says so
        const pinFailureBefore = pinNumberFailureStore.value;
        const chip = {
            text: person
                ? $_("native.walletFlows.pinSend", { values: { amount, name: recipient.name } })
                : $_("native.walletFlows.pinSendAddress", { values: { amount } }),
            amount,
            token: { symbol: face.symbol, mark: face.mark, grad: face.grad, logo: face.logo },
        };
        const outcome = await pinAction.during(chip, () =>
            sendFromWallet(
                client,
                details,
                details.balance,
                {
                    amountText,
                    max,
                    userId: person ? recipient.userId : undefined,
                    to: person ? recipient.userId : recipient.address,
                    network: sendNetwork(route),
                    memo: person ? memo.trim() : undefined,
                },
                details.symbol === BTC_SYMBOL ? btcFees.current : undefined,
            ),
        );
        busy = false;
        switch (outcome.kind) {
            case "sent":
                step = "sent";
                void client.refreshAccountBalance(details.ledger, false);
                return;
            case "not_sent":
            case "nothing":
                step = "form";
                return;
            case "too_small":
                step = "form";
                context.toast(
                    interpolateNewUi(
                        $_,
                        i18nKey("minimumAmount", {
                            amount: formatTokens(outcome.minimum, details.decimals),
                            symbol: details.symbol,
                        }),
                    ),
                );
                return;
            case "failed":
                step = "form";
                context.toast(
                    failure(
                        pinNumberFailureStore.value !== undefined &&
                            pinNumberFailureStore.value !== pinFailureBefore
                            ? "pin"
                            : outcome.reason,
                    ),
                );
                return;
        }
    }

    // the receipt shows once the PIN's in (while the PIN sheet is up, the form stays under it)
    const showReceipt = $derived(step === "sent" || (step === "sending" && $pinNumberResolverStore === undefined));

    function done() {
        if (chosen !== undefined) navigate(tokenUrl(chosen));
    }

    function viewChat() {
        if (to?.kind !== "person") return;
        navigate(routeForChatIdentifier("chats", { kind: "direct_chat", userId: to.userId }));
    }

    const receiptRows = $derived.by((): SummaryRow[] => {
        if (receipt === undefined) return [];
        const rows: SummaryRow[] = [
            { label: $_("native.walletFlows.to"), value: receipt.to },
            { label: $_("native.walletFlows.amount"), value: receipt.amount },
            { label: $_("native.walletFlows.networkFee"), value: receipt.fee },
        ];
        if (receipt.memo !== "") rows.push({ label: $_("native.walletFlows.message"), value: receipt.memo });
        return rows;
    });

    const title = $derived(
        face === undefined
            ? $_("native.walletFlows.send")
            : $_("native.wallet.sendSymbol", { values: { symbol: face.symbol } }),
    );
</script>

<div class="flow">
    <NativePageHeader {title} onBack={context.back}>
        <span class="step">
            {$_("native.walletFlows.stepOf", { values: { step: showReceipt ? 2 : 1, steps: 2 } })}
        </span>
    </NativePageHeader>

    {#if !showReceipt}
        <div class="scroll" {@attach aboveKeyboard()}>
            <section>
                <div class="label"><ListSectionLabel label={$_("native.walletFlows.token")} /></div>
                <FlowPicker
                    placeholder={$_("native.walletFlows.chooseToken")}
                    icon="wallet"
                    onClick={() => (sheet = "token")}>
                    {#if face !== undefined}
                        <TokenAvatar size={40} symbol={face.symbol} mark={face.mark} gradient={face.grad} logo={face.logo} />
                        <span class="names">
                            <span class="name">{face.symbol}</span>
                            <span class="meta">
                                {$_("native.walletFlows.balance", {
                                    values: { amount: token === undefined ? "" : formatTokens(token.balance, token.decimals) },
                                })}
                            </span>
                        </span>
                    {/if}
                </FlowPicker>
            </section>

            <section>
                <div class="label"><ListSectionLabel label={$_("native.walletFlows.to")} /></div>
                <FlowPicker
                    placeholder={$_("native.walletFlows.chooseRecipient")}
                    icon="user"
                    onClick={() => (sheet = "recipient")}>
                    {#if to !== undefined}
                        {#if to.kind === "person"}
                            <Avatar size={40} color={swatchFor(to.userId)} url={$allUsersStore.get(to.userId)?.blobUrl} />
                        {:else}
                            <span class="circle"><span class="wallet-icon"></span></span>
                        {/if}
                        <span class="names">
                            <span class="name">{toName}</span>
                            <span class="meta mono">{to.kind === "person" ? to.handle : to.address}</span>
                        </span>
                    {/if}
                </FlowPicker>
            </section>

            <section>
                <div class="label"><ListSectionLabel label={$_("native.walletFlows.amount")} /></div>
                <div class="amount-card">
                    <label class="amount-line">
                        <input
                            class="amount"
                            style:width={`${Math.max(1, (amountText || "0").length) + 0.4}ch`}
                            value={amountText}
                            oninput={typed}
                            inputmode="decimal"
                            autocomplete="off"
                            placeholder="0"
                            aria-label={$_("native.walletFlows.amount")}
                            disabled={token === undefined} />
                        <span class="amount-symbol">{face?.symbol ?? ""}</span>
                    </label>
                    <span class="note" class:warn={note.warn}>{note.text}</span>
                    <QuickPicks onPick={quick} disabled={token === undefined || to === undefined} />
                </div>
            </section>

            {#if to?.kind === "person"}
                <section>
                    <div class="label"><ListSectionLabel label={$_("native.walletFlows.messageOptional")} /></div>
                    <textarea
                        class="message"
                        rows="2"
                        bind:value={memo}
                        placeholder={$_("native.walletFlows.messagePlaceholder")}
                        aria-label={$_("native.walletFlows.message")}></textarea>
                </section>
            {/if}

            <SummaryRows {rows} />
        </div>
        <div class="foot">
            <Button
                label={cta}
                icon="send"
                size="lg"
                fullWidth
                busy={busy}
                disabled={check.cta.kind !== "send"}
                onClick={send} />
        </div>
    {:else if receipt !== undefined}
        <div class="receipt">
            <FlowResult
                done={step === "sent"}
                title={step === "sent"
                    ? $_("native.walletFlows.sent", { values: { amount: receipt.amount } })
                    : $_("native.walletFlows.sending")}
                sub={step === "sent"
                    ? receipt.person
                        ? $_("native.walletFlows.sentToPerson", { values: { name: receipt.to } })
                        : $_("native.walletFlows.sentToAddress")
                    : $_("native.walletFlows.sendingSub")}
                busyLabel={$_("native.walletFlows.sending")} />
            <div class="receipt-rows"><SummaryRows rows={receiptRows} /></div>
        </div>
        <div class="foot receipt-foot" class:two={receipt.person} class:shown={step === "sent"} inert={step !== "sent"}>
            {#if receipt.person}
                <Button label={$_("native.walletFlows.viewInChat")} variant="secondary" size="lg" fullWidth onClick={viewChat} />
            {/if}
            <Button label={$_("native.walletFlows.done")} size="lg" fullWidth onClick={done} />
        </div>
    {/if}
</div>

<SupportedTokensSheet
    open={sheet === "token"}
    {figures}
    title={$_("native.walletFlows.chooseToken")}
    searchable={false}
    offered={(id) => ($enhancedCryptoLookup.get(id)?.balance ?? 0n) > 0n}
    selected={chosen}
    onClose={() => (sheet = undefined)}
    onPick={pickToken} />

<RecipientSheet
    open={sheet === "recipient"}
    symbol={token?.symbol ?? ""}
    {contacts}
    {saved}
    {takesAddress}
    selected={to}
    onPick={pickRecipient}
    onRefused={(message) => context.toast(message)}
    onClose={() => (sheet = undefined)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .flow {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .step {
        padding-inline-end: 10px;
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-22);
        padding: var(--space-8) var(--space-16) var(--space-16);
    }

    section {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .label {
        padding-inline-start: var(--space-4);
    }

    .names {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .name {
        font: var(--weight-bold) text-size(15.5px) / 1.1 var(--font-sans);
        @include truncate;
    }

    .meta {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
        @include truncate;

        &.mono {
            font-family: var(--font-mono);
        }
    }

    .circle {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--overlay-2);
        @include flex-center;
    }

    .wallet-icon {
        width: 18px;
        height: 18px;
        background: var(--ink-2);
        mask: var(--icon-wallet) center / contain no-repeat;
    }

    .amount-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px 14px 14px;
        border-radius: var(--radius-lg);
        background: var(--overlay-1);
    }

    .amount-line {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: var(--space-8);
        max-width: 100%;
    }

    // 16px or more, or iOS zooms in on focus
    .amount {
        min-width: 1ch;
        max-width: 240px;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: 800 text-size(40px) / 1.1 var(--font-sans);
        letter-spacing: -0.02em;
        text-align: end;

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .amount-symbol {
        font: var(--weight-bold) text-size(18px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .note {
        font: var(--weight-medium) text-size(13px) / 1 var(--font-mono);
        color: var(--ink-3);

        &.warn {
            color: var(--status-warning);
        }
    }

    .message {
        display: block;
        width: 100%;
        min-height: 72px;
        box-sizing: border-box;
        padding: 14px var(--space-16);
        border: 0;
        outline: 0;
        resize: none;
        field-sizing: content;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-medium) text-size(16px) / 1.45 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .foot {
        flex: none;
        padding: var(--space-12) var(--space-16) calc(var(--safe-bottom) + var(--space-16));
    }

    .receipt {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 20px;
        padding: var(--space-8) var(--space-16);
    }

    .receipt-rows {
        align-self: stretch;
    }

    // Done (and View in chat) only once it's sent
    .receipt-foot {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-8);
        opacity: 0;
        transition: opacity 0.2s;

        &.two {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }

        &.shown {
            opacity: 1;
        }
    }

    @include reduced-motion {
        .receipt-foot {
            transition: none;
        }
    }
</style>
