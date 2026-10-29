<!-- The wallet's page (region "wallet", 6a #10120): WalletMain on /wallet (All activity) and
     /wallet/:ledger (the token's page: summary, facts and its history from the index canister, a
     page at a time, TransactionHistoryState). The URL says which: WalletMain's own moves (a row on
     All activity, Back to All activity) navigate there. There's no history across tokens, so All
     activity says to pick a token (GAPS). Receive (6b) is /wallet/receive?token=<ledger>: the
     token's networks and address (ReceiveAccount), its QR, Share to chat, the balance refreshed
     every 10 s while it's open. Send (6b) is /wallet/send?token=<ledger>: to a user already DM'd,
     a transfer in their DM; to an address, a withdrawal over the ledger or, for BTC, Bitcoin's own
     network. The client asks for the PIN (S3), so Send has no PIN step of its own. Recipients
     (6d) is /wallet/recipients: the address book (namedAccountsStore), saved through the client
     under the old address book's rules (logic/wallet/addressBook). Swap isn't built yet (6c): its
     path shows the token's page, or All activity. -->
<script lang="ts">
    import {
        allUsersStore,
        BTC_SYMBOL,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        directChatUsers,
        enhancedCryptoLookup,
        exchangeRatesLookupStore,
        formatTokens,
        LEDGER_CANISTER_CKSOL,
        LEDGER_CANISTER_ICP,
        namedAccountsStore,
        routeForChatIdentifier,
        serverDirectChatsStore,
        swappableTokensStore,
        walletConfigStore,
        type NamedAccount,
        type OpenChat,
    } from "@client";
    import WalletMain from "@openchat/ui/src/features/components/WalletMain.svelte";
    import type { ComponentProps } from "svelte";
    import { accountTransactionUrl } from "@src/logic/wallet/accountTransactions";
    import { ReceiveAccount, type ReceiveToken } from "@src/logic/wallet/receiveAccount.svelte";
    import QRCode from "@src/core/QRCode.svelte";
    import type { ShareChat } from "@openchat/ui/src/features/components/WalletReceive.svelte";
    import type { WalletSendRequest } from "@openchat/ui/src/features/components/WalletSend.svelte";
    import type {
        Recipient,
        RecipientDraft,
    } from "@openchat/ui/src/features/components/WalletRecipients.svelte";
    import {
        checkRecipientAddress,
        checkRecipientName,
        recipientAddressError,
        RECIPIENT_NAME_MAX,
    } from "@src/logic/wallet/addressBook";
    import { recipientToSave } from "@src/utils/savedRecipient";
    import { sendInDirectChat } from "@src/logic/cryptoTransfer/cryptoTransferForm.svelte";
    import {
        acceptsAddress,
        ownAccounts,
        sendAnswer,
        sendCost,
        sendNetworks,
        sendPlan,
        type BtcWithdrawal,
    } from "@src/logic/wallet/walletSend";
    import { CkbtcWithdrawalInfoRequests } from "@src/utils/ckbtcWithdrawalInfo";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { sharedLinkText } from "../share/share.adapter";
    import { SharePicker } from "../share/sharePicker.svelte";
    import {
        hasTransactionHistory,
        tokenActions,
        tokenActionsContext,
    } from "@src/logic/wallet/tokenActions";
    import { TransactionHistoryState } from "@src/logic/wallet/transactionHistoryState.svelte";
    import { hideTokenBalances } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "@src/i18n/i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import {
        addressNetworkName,
        receiveNetworks,
        sendContacts,
        tokenActivity,
        wholeTokens,
        walletRecipients,
        walletToken,
    } from "./wallet.adapter";
    import { walletCatalogue } from "./walletCatalogue.svelte";
    import { walletRequests } from "./walletRequests.svelte";

    type WalletMainProps = ComponentProps<typeof WalletMain>;

    let { region }: ScreenProps<Extract<MiddleRegion, { kind: "wallet" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the saved account names a transaction's other side can go by (namedAccountsStore)
    onMount(() => client.loadSavedCryptoAccounts());

    // the token whose page shows: /wallet/:ledger, and for now Send / Receive / Swap's ?token
    const ledger = $derived(
        region.view === "all" || region.view === "recipients" ? undefined : region.ledger,
    );

    // the catalogue (a token you don't hold still gets its page, at zero), and the token the URL
    // names if the catalogue leaves it out (a disabled one, at zero) but the app knows it
    const tokens = $derived.by(() => {
        const catalogue = walletCatalogue.tokens;
        const extra = ledger === undefined ? undefined : $enhancedCryptoLookup.get(ledger);
        if (extra === undefined || catalogue.some((t) => t.id === extra.ledger)) return catalogue;
        const ctx = tokenActionsContext($swappableTokensStore, $walletConfigStore);
        const price = $exchangeRatesLookupStore.get(extra.ledger)?.toUSD;
        return [...catalogue, walletToken(extra, price, tokenActions(extra, ctx))];
    });

    // WalletMain follows the URL: a request each time it names another page (the panel's asks
    // share the slot); none is left behind for the next wallet page. A page WalletMain moved to
    // itself (and reported) isn't asked for again, which would reopen a flow already open
    let reported: { view: string; token: string | null } | undefined;
    $effect(() => {
        const view =
            region.view === "receive" || region.view === "send" || region.view === "recipients"
                ? region.view
                : ledger === undefined
                  ? "all"
                  : "token";
        const page = ledger;
        untrack(() => {
            if (reported?.view === view && reported.token === (page ?? null)) return;
            walletRequests.send(page === undefined ? { view } : { view, token: page });
        });
    });
    onDestroy(() => walletRequests.clear());

    // the shown token's history, loaded when its page opens
    let history = $state<{ ledger: string; state: TransactionHistoryState } | undefined>();
    $effect(() => {
        if (ledger === undefined || history?.ledger === ledger || !indexed) return;
        const state = new TransactionHistoryState(client, $cryptoLookup.get(ledger)?.index);
        history = { ledger, state };
        state.load();
    });

    const shown = $derived(history?.ledger === ledger ? history?.state : undefined);
    const token = $derived(ledger === undefined ? undefined : $cryptoLookup.get(ledger));
    // only a token with an index canister has a history
    const indexed = $derived(token !== undefined && hasTransactionHistory(token));
    const activity = $derived(
        shown?.state.kind === "loaded" && token !== undefined
            ? tokenActivity(
                  shown.state.history.transactions,
                  token,
                  $exchangeRatesLookupStore.get(token.ledger)?.toUSD,
                  {
                      me: {
                          userId: $currentUserStore.userId,
                          cryptoAccount: $currentUserStore.cryptoAccount,
                      },
                      users: $allUsersStore,
                      saved: $namedAccountsStore,
                      unknown: $_("unknownUser"),
                  },
              )
            : [],
    );
    const historyProp = $derived.by((): WalletMainProps["history"] => {
        if (token !== undefined && !indexed) return { state: "unavailable" };
        if (shown === undefined) return undefined;
        const state = shown.state;
        return state.kind === "loaded"
            ? { state: "loaded", more: shown.moreAvailable, loadingMore: state.loadingMore }
            : { state: state.kind };
    });

    async function loadMore(): Promise<void> {
        if ((await shown?.loadMore()) === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
        }
    }

    // a transaction opens on the token's explorer
    function openActivity(id: string): void {
        const format = token?.transactionUrlFormat;
        if (format) window.open(accountTransactionUrl(format, BigInt(id)), "_blank");
    }

    // WalletMain's own moves go to their URL
    function viewChanged({ view, token: id }: { view: string; token: string | null }): void {
        // Receive opens on its token's first network each time: a network picked lasts only while
        // it stays open (WalletMain reports every page it moves to, never a network picked)
        const stillReceiving =
            view === "receive" && reported?.view === "receive" && reported.token === id;
        if (!stillReceiving) receiveAccount.selectedNetwork = undefined;
        reported = { view, token: id };
        const path =
            view === "receive" || view === "send"
                ? `/wallet/${view}${id !== null ? `?token=${id}` : ""}`
                : view === "token" && id !== null
                  ? `/wallet/${id}`
                  : view === "recipients"
                    ? "/wallet/recipients"
                    : "/wallet";
        // the page is its path and ?token=: the URL's other params (a dialog's ?diamond …) stay
        // unless the page changes
        const here = window.location;
        const token = new URLSearchParams(here.search).get("token");
        const current = `${here.pathname}${token !== null ? `?token=${token}` : ""}`;
        if (path !== current) navigate(path);
    }

    // Receive: the token's networks, the address on the chosen one and what depositing costs
    const receiving = $derived(region.view === "receive" ? region.ledger : undefined);
    const NO_TOKEN: ReceiveToken = {
        ledger: "",
        symbol: "",
        decimals: 8,
        oneSecEnabled: false,
        evmContractAddresses: [],
    };
    const receiveAccount = new ReceiveAccount(
        client,
        () => (receiving === undefined ? undefined : $cryptoLookup.get(receiving)) ?? NO_TOKEN,
        () => ({
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        }),
    );
    const receiveToken = $derived(
        receiving === undefined ? undefined : $cryptoLookup.get(receiving),
    );
    const networks = $derived(
        receiveToken === undefined
            ? undefined
            : receiveNetworks(receiveAccount, receiveToken.symbol, (key, values) =>
                  $_(key, { values }),
              ),
    );

    // deposits arrive while Receive is open: its token's balance is refreshed every 10 s
    $effect(() => {
        const ledger = receiving;
        if (ledger === undefined) return;
        const timer = setInterval(() => client.refreshAccountBalance(ledger, false), 10_000);
        return () => clearInterval(timer);
    });

    // Share to chat: the address (and the user's message) posted to any of their chats
    // svelte-ignore state_referenced_locally
    const sharePicker = new SharePicker(client, $_, () => undefined);
    // only built while Receive is open: it follows every chat and user
    const shareChats = $derived(
        receiving === undefined
            ? []
            : sharePicker.chats().map(
                  (c): ShareChat => ({
                      id: c.id,
                      name: c.name,
                      kind: c.sub,
                      grad: c.grad,
                      radius: c.radius,
                  }),
              ),
    );

    async function share({
        chatId,
        message,
        address,
    }: {
        chatId: string;
        message: string;
        address: string;
    }): Promise<void> {
        const id = sharePicker.chatId(chatId);
        if (id === undefined) throw new Error("not a chat to share to");
        const outcome = await client.sendMessage(
            { chatId: id },
            sharedLinkText(message, address),
            false,
            undefined,
        );
        if (outcome.kind !== "posted") throw new Error(`address not shared: ${outcome.kind}`);
    }

    // Send: the people are the users already DM'd (mobile's rule); the client asks for the PIN
    const sending = $derived(region.view === "send");
    const contacts = $derived(
        sendContacts(directChatUsers($serverDirectChatsStore, $allUsersStore)),
    );

    // a Bitcoin send's minter fee and minimum, asked each time Send opens while BTC is held (Send
    // may pick BTC itself when opened without a token), and again 10 s after a failure; only the
    // latest answer counts (#9638), and none from an earlier opening
    let btcWithdrawal = $state<BtcWithdrawal>();
    let btcRetry: ReturnType<typeof setTimeout> | undefined;
    const btcInfo = new CkbtcWithdrawalInfoRequests(
        (amount) => client.getCkbtcMinterWithdrawalInfo(amount),
        (info) => (btcWithdrawal = { fee: info.feeEstimate, minimum: info.minWithdrawalAmount }),
        500,
        () => {
            if (sendingBtc) btcRetry = setTimeout(() => btcInfo.now(0n), 10_000);
        },
    );
    const btcToken = $derived(
        [...$enhancedCryptoLookup.values()].find((t) => t.symbol === BTC_SYMBOL),
    );
    const sendingBtc = $derived(sending && btcToken !== undefined && btcToken.balance > 0n);
    $effect(() => {
        if (!sendingBtc) return;
        untrack(() => btcInfo.now(0n));
        return () => {
            clearTimeout(btcRetry);
            btcInfo.cancel();
            btcWithdrawal = undefined;
        };
    });
    // a Bitcoin address costs the approval and the minter's fee on top. The design's other route,
    // ckBTC to that address, can't reach it (the ledger only sends to IC accounts), so Send only
    // offers Bitcoin's own
    const btcFees = $derived.by((): WalletMainProps["btcFees"] => {
        if (btcToken === undefined || btcWithdrawal === undefined) return {};
        return {
            btc: wholeTokens(sendCost(btcToken, "btc", btcWithdrawal), btcToken.decimals),
        };
    });

    // the user's own wallet for a token, in each form, worked out once per token and user
    const ownWallets = $derived.by(() => {
        const owner = {
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        };
        const bySymbol = new Map<string, string[]>();
        return (symbol: string): string[] => {
            let own = bySymbol.get(symbol);
            if (own === undefined) {
                own = ownAccounts(symbol, owner);
                bySymbol.set(symbol, own);
            }
            return own;
        };
    });

    // never the user's own wallet, nor an account of a MultiUser user id, and only on a network
    // the send can reach
    function checkAddress(address: string, symbol: string): boolean {
        return acceptsAddress(address, sendNetworks(symbol), {
            ownAccounts: ownWallets(symbol),
            isUserIdAccount: (a) => client.isAccountOfMultiUserCanisterUserId(a),
        });
    }

    // One send per confirm (WalletSend can't confirm again while this runs): to a person a
    // transfer in their DM, to an address a withdrawal, each through the client's PIN prompt.
    // Resolves `false` when nothing was sent and there's nothing to say; rejects on a failure,
    // which the toast explains
    async function send(x: WalletSendRequest): Promise<boolean> {
        const token = enhancedCryptoLookup.value.get(x.token);
        if (token === undefined) throw new Error(`no token ${x.token} to send`);
        const plan = sendPlan(
            {
                amountText: x.amountText,
                max: x.max,
                userId: x.person ? x.userId : undefined,
                to: x.to,
                network: x.network,
            },
            token,
            token.balance,
            token.symbol === BTC_SYMBOL ? btcWithdrawal : undefined,
        );
        if (plan === undefined) throw new Error("nothing to send");
        if (plan.kind === "too_small") {
            const amount = formatTokens(plan.minimum, token.decimals);
            toastStore.showFailureToast(i18nKey("minimumAmount", { amount, symbol: token.symbol }));
            throw new Error("under the minimum");
        }
        const outcome =
            plan.kind === "transfer"
                ? await sendInDirectChat(client, token, plan.userId, plan.amount, x.memo ?? "")
                : await client.withdraw({
                      ledger: token.ledger,
                      symbol: token.symbol,
                      route: plan.route,
                      to: plan.to,
                      amount: plan.amount,
                      fee: plan.fee,
                  });
        const answer = sendAnswer(outcome);
        switch (answer.kind) {
            case "sent":
                return true;
            case "not_sent":
                return false;
            case "failed":
                toastStore.showFailureToast(
                    answer.reason === "pin" ? pinNumberErrorMessageStore : answer.reason,
                );
                throw new Error("send failed");
        }
    }

    // Recipients (6d): the address book, as the client keeps it (namedAccountsStore). An address is
    // checked before anything is saved (6d invariant 1); an edit only renames (6d invariant 2:
    // the canister keys a saved address by its account, so a new address would leave the old one);
    // a removal deletes by name, as the canister does
    const isUserIdAccount = (a: string): boolean => client.isAccountOfMultiUserCanisterUserId(a);
    // the tokens Send opens on for a saved address: BTC for Bitcoin, ckSOL for Solana, else ICP
    const recipientLedgers = $derived({
        icp: LEDGER_CANISTER_ICP,
        btc: btcToken?.ledger,
        sol: $cryptoLookup.has(LEDGER_CANISTER_CKSOL) ? LEDGER_CANISTER_CKSOL : undefined,
    });

    function checkRecipient(
        address: string,
        id: string | null,
    ): { network: string } | { error: string } {
        const check = checkRecipientAddress(
            address,
            $namedAccountsStore,
            isUserIdAccount,
            id ?? undefined,
        );
        if (check.kind === "valid") return { network: addressNetworkName(check.network) };
        const error = recipientAddressError(check);
        return { error: error === undefined ? "" : $_(error.key, { values: error.params }) };
    }

    function checkName(name: string, id: string | null): string | null {
        const check = checkRecipientName(name, $namedAccountsStore, id ?? undefined);
        return check.kind === "taken" ? $_("addressBook.nameTaken") : null;
    }

    async function addRecipient(draft: RecipientDraft): Promise<Recipient> {
        const address = draft.address.trim();
        const name = draft.name.trim();
        const ok =
            checkRecipientAddress(address, $namedAccountsStore, isUserIdAccount).kind === "valid" &&
            checkRecipientName(name, $namedAccountsStore).kind === "valid";
        if (!ok) throw new Error("not a recipient to save");
        await saveAccount({ name, account: address });
        return { id: address, name, address };
    }

    async function renameRecipient(recipient: Recipient): Promise<void> {
        const editing = $namedAccountsStore.find((a) => a.account === recipient.id);
        const name = recipient.name.trim();
        if (editing === undefined) throw new Error("no such recipient");
        if (checkRecipientName(name, $namedAccountsStore, editing.account).kind !== "valid") {
            throw new Error("name taken");
        }
        await saveAccount(recipientToSave(editing, name, recipient.address));
    }

    async function saveAccount(account: NamedAccount): Promise<void> {
        const resp = await client.saveCryptoAccount(account);
        if (resp.kind !== "success") throw new Error(`recipient not saved: ${resp.kind}`);
    }

    async function removeRecipient(id: string): Promise<void> {
        const account = $namedAccountsStore.find((a) => a.account === id);
        if (account === undefined) return;
        const resp = await client.deleteCryptoAccount(account.name);
        if (resp.kind !== "success") throw new Error(`recipient not removed: ${resp.kind}`);
    }

    // "View in chat": the DM the tokens went to
    function openDm({ userId }: { userId: string }): void {
        navigate(routeForChatIdentifier("chats", { kind: "direct_chat", userId }));
    }
</script>

<WalletMain
    {tokens}
    request={walletRequests.current}
    tokensLoading={$cryptoLookup.size === 0}
    {activity}
    balanceHidden={$hideTokenBalances}
    history={historyProp}
    onMoreHistory={loadMore}
    onRetryHistory={() => shown?.load()}
    onActivity={openActivity}
    onViewChange={viewChanged}
    onBalanceHiddenChange={(hidden) => hideTokenBalances.set(hidden)}
    handle={$currentUserStore.username ? `@${$currentUserStore.username}` : undefined}
    flows={["send", "receive"]}
    {contacts}
    {btcFees}
    btcRoutes={["btc"]}
    sendHostPin
    {checkAddress}
    onSent={send}
    onMessage={openDm}
    recipients={walletRecipients($namedAccountsStore, recipientLedgers)}
    onAddRecipient={addRecipient}
    onUpdateRecipient={renameRecipient}
    onRemoveRecipient={removeRecipient}
    recipientOptions={{
        checkAddress: checkRecipient,
        checkName: checkName,
        editAddress: false,
        tokenLocks: false,
        lastSent: false,
        maxNameLength: RECIPIENT_NAME_MAX,
    }}
    receiveNetworks={networks}
    receiveNetwork={receiveAccount.selectedNetwork}
    onReceiveNetwork={(id) => (receiveAccount.selectedNetwork = id)}
    chats={shareChats}
    onShare={share}
    {qr}
    allActivityNote={{
        title: "ui.walletMain.allActivityUnavailableTitle",
        body: "ui.walletMain.allActivityUnavailableBody",
    }} />

{#snippet qr(address: string)}
    <QRCode text={address} logo={receiveToken?.logo || undefined} />
{/snippet}
