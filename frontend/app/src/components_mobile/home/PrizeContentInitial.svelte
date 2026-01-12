<script lang="ts">
    import {
        Avatar,
        BodySmall,
        ColourVars,
        Column,
        IconButton,
        Row,
        Subtitle,
    } from "component-lib";
    import type { MessageContext, PrizeContentInitial } from "openchat-client";
    import { enhancedCryptoLookup, localUpdates } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import MulticolourText from "../MulticolourText.svelte";
    import Translatable from "../Translatable.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    interface Props {
        content: PrizeContentInitial;
        ctx: MessageContext;
    }

    let { content, ctx }: Props = $props();

    let tokenState = $derived(new TokenState($enhancedCryptoLookup.get(content.transfer.ledger)!));

    function removeDraft() {
        localUpdates.draftMessages.delete(ctx);
    }
</script>

<Column gap={"xs"}>
    <Row
        gap={"lg"}
        crossAxisAlignment={"center"}
        padding={["md", "lg", "md", "sm"]}
        borderRadius={"lg"}
        background={ColourVars.background1}>
        <Avatar size={"lg"} url={tokenState.logo} />
        <Column>
            <Subtitle ellipsisTruncate fontWeight={"bold"}>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey(
                                `${tokenState.formatTokens(content.amount)} ${tokenState.symbol}`,
                            ),
                            colour: "primary",
                        },
                        { text: i18nKey(" "), colour: "textPrimary" },
                        {
                            text: i18nKey("Prize"),
                            colour: "textPrimary",
                        },
                    ]} />
            </Subtitle>
            <BodySmall colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("You are sending a prize draw message")} />
            </BodySmall>
        </Column>
        <IconButton onclick={removeDraft}>
            {#snippet icon()}
                <Close color={ColourVars.textSecondary} />
            {/snippet}
        </IconButton>
    </Row>

    <Row
        gap={"lg"}
        crossAxisAlignment={"center"}
        padding={["md", "lg", "md", "sm"]}
        borderRadius={"lg"}
        background={ColourVars.background1}>
        <TransferFeesMessage
            symbol={tokenState.symbol}
            tokenDecimals={tokenState.decimals}
            transferFees={content.fees} />
    </Row>
</Column>
