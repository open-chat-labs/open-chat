<script lang="ts">
    import { hideTokenBalances } from "@src/stores/settings";
    import { Avatar, Body, Subtitle, Container } from "component-lib";
    import { OpenChat, type EnhancedTokenDetails } from "openchat-client";
    import { getContext } from "svelte";

    import { TokenState, type ConversionToken } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedConversion: ConversionToken;
        token: EnhancedTokenDetails;
        onClick?: (tokenState: TokenState) => void;
    }

    let { selectedConversion, token, onClick }: Props = $props();

    let tokenState = $derived.by(() => {
        const ts = new TokenState(token, selectedConversion);
        client.refreshAccountBalance(token.ledger, true);
        return ts;
    });
</script>

<Container
    supplementalClass={"wallet_token"}
    gap={"lg"}
    onClick={onClick ? () => onClick(tokenState) : undefined}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    padding={["md", "lg"]}>
    <Avatar url={token.logo} size={"sm"}></Avatar>
    <Container direction={"vertical"}>
        <Subtitle width={"hug"} fontWeight={"bold"}>{token.symbol}</Subtitle>
    </Container>
    <Body
        blur={$hideTokenBalances}
        align={"end"}
        width={{ size: "6rem" }}
        fontWeight={"bold"}
        colour={"textSecondary"}>
        {@const renderValue =
            tokenState.cryptoBalance === 0n ? "-" : tokenState.formattedTokenBalance}
        {renderValue}
    </Body>
</Container>
