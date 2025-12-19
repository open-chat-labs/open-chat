<script lang="ts">
    import {
        Avatar,
        BodySmall,
        Caption,
        ColourVars,
        Column,
        IconButton,
        Row,
        Subtitle,
        type Padding,
    } from "component-lib";
    import type { CryptocurrencyContent, MessageContext, OpenChat } from "openchat-client";
    import { currentUserIdStore, enhancedCryptoLookup, localUpdates } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Alert from "svelte-material-icons/AlertRhombusOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import ContentCaption from "./ContentCaption.svelte";
    import Markdown from "./Markdown.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: CryptocurrencyContent;
        me?: boolean;
        reply?: boolean;
        senderId: string;
        ctx: MessageContext;
        draft?: boolean;
    }

    let { content, me = false, reply = false, senderId, draft = false, ctx }: Props = $props();

    let tokenState = $derived(new TokenState($enhancedCryptoLookup.get(content.transfer.ledger)!));
    let transferText = $derived(
        client.buildCryptoTransferText($_, $currentUserIdStore, senderId, content, me),
    );
    let transactionLinkText = $derived(client.buildTransactionLink($_, content.transfer));

    function removeDraft() {
        localUpdates.draftMessages.delete(ctx);
    }
    let padding = $derived<Padding>(draft ? ["sm", "lg", "sm", "sm"] : ["sm", "zero"]);
</script>

<Column gap={"sm"}>
    <Row
        gap={"lg"}
        crossAxisAlignment={"center"}
        {padding}
        borderRadius={"lg"}
        background={draft ? ColourVars.background1 : undefined}>
        <Avatar size={"lg"} url={tokenState.logo} />
        <Column>
            <Subtitle ellipsisTruncate fontWeight={"bold"}>
                {`${tokenState.formatTokens(content.transfer.amountE8s)} ${tokenState.symbol}`}
            </Subtitle>
            <BodySmall colour={draft ? "textSecondary" : "textPrimary"}>
                {#if transferText !== undefined}
                    <Markdown text={transferText} inline={true} />
                {:else}
                    <Translatable resourceKey={i18nKey("tokenTransfer.unexpected")} />
                {/if}
            </BodySmall>
            {#if !draft && transactionLinkText !== undefined}
                <Caption>
                    <Markdown text={transactionLinkText} inline={!reply} />
                </Caption>
            {/if}
        </Column>
        {#if draft}
            <IconButton onclick={removeDraft}>
                {#snippet icon()}
                    <Close color={ColourVars.textSecondary} />
                {/snippet}
            </IconButton>
        {/if}
    </Row>
    {#if draft}
        <Row
            gap={"lg"}
            crossAxisAlignment={"center"}
            padding={["sm", "lg", "sm", "sm"]}
            borderRadius={"lg"}
            background={ColourVars.background1}>
            <Alert size={"1.5rem"} color={ColourVars.warning} />
            <BodySmall colour={"warning"}>
                <Translatable
                    resourceKey={i18nKey("tokenTransfer.warning", { token: tokenState.symbol })} />
            </BodySmall>
        </Row>
    {:else}
        <ContentCaption caption={content.caption} edited={false} />
    {/if}
</Column>

<!-- {#if transferText !== undefined}
    <div class="message">
        <div class="logo-wrapper">
            <img class="logo" src={tokenState.logo} />
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
    <div class="unexpected">
        <Translatable resourceKey={i18nKey("tokenTransfer.unexpected")} />
    </div>
{/if} -->

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
