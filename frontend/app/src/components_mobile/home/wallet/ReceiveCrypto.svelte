<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { Avatar, Body, Column, Row } from "component-lib";
    import { publish, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import type { TokenState } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        tokenState: TokenState;
    }

    let { tokenState }: Props = $props();

    let error: string | undefined = $state(undefined);

    let title = $derived(i18nKey(`cryptoAccount.receiveToken`, { symbol: tokenState.symbol }));

    function onBack() {
        tokenState.refreshBalance(client);
        publish("closeModalPage");
    }
</script>

<SlidingPageContent {onBack} {title}>
    <Column gap={"lg"} padding={"lg"}>
        <Row gap={"lg"} padding={["lg", "md"]}>
            <Avatar size={"lg"} url={tokenState.logo} />
            <Body>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("Have your "),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey(tokenState.symbol),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(
                                " address QR code scanned by the sender, or copy / paste it in a message!",
                            ),
                            colour: "textPrimary",
                        },
                    ]} />
            </Body>
        </Row>
        <Column mainAxisAlignment={"center"}>
            <AccountInfo ledger={tokenState.ledger} />
            {#if error}
                <ErrorMessage>{error}</ErrorMessage>
            {/if}
        </Column>
    </Column>
</SlidingPageContent>
