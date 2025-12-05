<script lang="ts">
    import { hideTokenBalances } from "@src/stores/settings";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        Container,
        Subtitle,
    } from "component-lib";
    import type { TokenState } from "./walletState.svelte";

    interface Props {
        tokenState: TokenState;
    }

    let { tokenState }: Props = $props();
</script>

<Container
    background={ColourVars.background1}
    supplementalClass={"wallet_token"}
    gap={"lg"}
    borderRadius={"lg"}
    mainAxisAlignment={"spaceBetween"}
    crossAxisAlignment={"center"}
    padding={"lg"}>
    <Avatar url={tokenState.token.logo}></Avatar>
    <Container direction={"vertical"}>
        <Body width={"hug"} fontWeight={"bold"}>{tokenState.token.symbol}</Body>
        <Caption width={"hug"} colour={"textSecondary"} fontWeight={"bold"}
            >{tokenState.token.name}</Caption>
    </Container>
    <Container overflow={"visible"} crossAxisAlignment={"end"} width={"hug"} direction={"vertical"}>
        <Subtitle blur={$hideTokenBalances} align={"end"} width={"hug"} fontWeight={"bold"}
            >{tokenState.formattedTokenBalance}</Subtitle>
        <BodySmall
            blur={$hideTokenBalances}
            align={"end"}
            width={"hug"}
            colour={"primary"}
            fontWeight={"bold"}>{tokenState.formattedConvertedValue}</BodySmall>
    </Container>
</Container>
