<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CryptocurrencyContent, OpenChat } from "openchat-client";
    import Markdown from "./Markdown.svelte";
    import Envelope from "../Envelope.svelte";
    import { getContext } from "svelte";
    import { cryptoLookup } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let content: CryptocurrencyContent;
    export let me: boolean = false;
    export let first: boolean;
    export let reply: boolean = false;
    export let senderId: string;
    export let groupChat: boolean;

    let symbol = cryptoLookup[content.transfer.token].symbol;

    $: transferText = client.buildCryptoTransferText($_, user.userId, senderId, content, me);
    $: transactionLinkText = client.buildTransactionLink($_, content.transfer);
</script>

{#if transferText !== undefined}
    <div class="message">
        <div class="env" class:me class:first class:groupChat>
            <Envelope {symbol} />
        </div>
        <div class="txt">
            <span class="transfer-txt">{transferText}</span>
        </div>
    </div>
    {#if transactionLinkText !== undefined}
        <div class="link">
            <Markdown text={transactionLinkText} inline={!reply} />
        </div>
    {/if}
{:else}
    <div class="unexpected">{$_("tokenTransfer.unexpected")}</div>
{/if}

{#if content.caption !== undefined}
    <Markdown text={content.caption} inline={!reply} />
{/if}

<style type="text/scss">
    .unexpected {
        @include font(light, italic, fs-90);
    }

    .link {
        text-align: center;
        margin-bottom: $sp3;
        @include font-size(fs-90);
    }

    .message {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 12px;
        margin-bottom: $sp3;
        padding: 0 $sp3;

        .env {
            margin-top: 30px;
            &.first:not(.me).groupChat {
                margin-top: 10px;
            }
        }

        .txt {
            flex: auto;
        }
    }

    .transfer-txt {
        @include font-size(fs-120);
        text-align: center;
        text-shadow: 0px -1px 0px rgba(0, 0, 0, 0.5);
    }

    .txt {
        display: flex;
        align-items: center;
    }
</style>
