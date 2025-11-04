<script lang="ts">
    import { Body, Container } from "component-lib";
    import { i18nKey } from "../../../i18n/i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import type { TokenState } from "./walletState.svelte";

    interface Props {
        tokenState: TokenState;
    }

    let { tokenState }: Props = $props();

    let error: string | undefined = $state(undefined);

    let title = $derived(i18nKey(`cryptoAccount.receiveToken`, { symbol: tokenState.symbol }));
</script>

<SlidingPageContent {title}>
    <Container gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container padding={["lg", "xl"]}>
            <Body>
                <Translatable
                    resourceKey={i18nKey(
                        `This is your ${tokenState.symbol} address for deposits in the OpenChat Wallet. Either have your address QR code scanned, or copy and paste your address in a message!`,
                    )} />
            </Body>
        </Container>
        <Container mainAxisAlignment={"center"}>
            <AccountInfo ledger={tokenState.ledger} />
            {#if error}
                <ErrorMessage>{error}</ErrorMessage>
            {/if}
        </Container>
    </Container>
</SlidingPageContent>
