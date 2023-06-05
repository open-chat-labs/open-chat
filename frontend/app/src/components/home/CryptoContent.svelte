<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CryptocurrencyContent, OpenChat } from "openchat-client";
    import Markdown from "./Markdown.svelte";
    import { getContext } from "svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { cryptoLookup } from "openchat-client";
    import page from "page";

    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let content: CryptocurrencyContent;
    export let me: boolean = false;
    export let reply: boolean = false;
    export let senderId: string;

    let symbol = cryptoLookup[content.transfer.token].symbol;

    $: transferText = client.buildCryptoTransferText($_, user.userId, senderId, content, me);
    $: transactionLinkText = client.buildTransactionLink($_, content.transfer);
</script>

{#if transferText !== undefined}
    <div class="message">
        <div class="logo-wrapper">
            <div class={`logo ${symbol.toLowerCase()}`} />
        </div>
        <div class="details">
            <div class="transfer-txt">{transferText}</div>
            <div class="links">
                <a href="?wallet" class="link icon">
                    <Wallet viewBox={"0 -2 24 24"} size={"1.5em"} color={"var(--txt)"} />
                </a>
                <div class="link wallet">
                    <Markdown text={`[${$_("wallet")}](?wallet)`} inline={!reply} />
                </div>
                {#if transactionLinkText !== undefined}
                    <div class="link transaction">
                        <Markdown text={transactionLinkText} inline={!reply} />
                    </div>
                {/if}
            </div>
        </div>
    </div>
{:else}
    <div class="unexpected">{$_("tokenTransfer.unexpected")}</div>
{/if}

{#if content.caption !== undefined}
    <Markdown text={content.caption} inline={!reply} />
{/if}

<style lang="scss">
    .unexpected {
        @include font(light, italic, fs-90);
    }

    .links {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .link {
        text-align: center;
        margin-bottom: $sp3;
        cursor: pointer;
        @include font-size(fs-80);

        &.wallet {
            border-right: 1px solid var(--txt-light);
        }

        &.icon {
            width: 10px;
        }
    }

    .logo {
        $size: toRem(55);
        width: $size;
        height: $size;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: top;

        -webkit-box-reflect: below 0
            linear-gradient(hsla(0, 0%, 100%, 0), hsla(0, 0%, 100%, 0) 45%, hsla(0, 0%, 100%, 0.2));

        &.icp {
            background-image: url("../assets/icp_token.svg");
        }
        &.sns1 {
            background-image: url("../assets/sns1_medium.png");
        }
        &.ckbtc {
            background-image: url("../assets/ckbtc_nobackground.svg");
        }
        &.chat {
            background-image: url("../assets/spinner.svg");
        }
    }

    .message {
        display: flex;
        align-items: center;
        gap: $sp4;
        padding: $sp3 0;
    }

    .transfer-txt {
        margin-bottom: $sp2;
    }
</style>
