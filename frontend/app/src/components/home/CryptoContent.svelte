<script lang="ts">
    import type { CryptocurrencyContent, OpenChat } from "openchat-client";
    import { cryptoLookup, currentUserIdStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: CryptocurrencyContent;
        me?: boolean;
        reply?: boolean;
        senderId: string;
    }

    let { content, me = false, reply = false, senderId }: Props = $props();

    let logo = $derived($cryptoLookup.get(content.transfer.ledger)?.logo);
    let transferText = $derived(
        client.buildCryptoTransferText($_, $currentUserIdStore, senderId, content, me),
    );
    let transactionLinkText = $derived(client.buildTransactionLink($_, content.transfer));
</script>

{#if transferText !== undefined}
    <div class="message">
        <div class="logo-wrapper">
            <img class="logo" src={logo} />
        </div>
        <div class="details">
            <div class="transfer-txt">
                <Markdown text={transferText} inline={true} />
            </div>
            <div class="links">
                {#if transactionLinkText !== undefined}
                    <div class="link transaction">
                        <Markdown text={transactionLinkText} inline={!reply} />
                    </div>
                {/if}
            </div>
        </div>
    </div>
{:else}
    <div class="unexpected"><Translatable resourceKey={i18nKey("tokenTransfer.unexpected")} /></div>
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
    }

    .logo {
        $size: toRem(55);
        width: $size;
        height: $size;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: top;
        border-radius: 50%;

        -webkit-box-reflect: below 0
            linear-gradient(hsla(0, 0%, 100%, 0), hsla(0, 0%, 100%, 0) 45%, hsla(0, 0%, 100%, 0.2));
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
