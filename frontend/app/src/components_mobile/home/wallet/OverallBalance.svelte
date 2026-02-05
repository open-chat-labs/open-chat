<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import { sum } from "@src/utils/math";
    import { ColourVars, Container, H1, IconButton, Subtitle, Row, Spinner } from "component-lib";
    import {
        type EnhancedTokenDetails,
        walletTokensSorted as accountsSorted,
    } from "openchat-client";
    import EyeOff from "svelte-material-icons/EyeOffOutline.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import Reload from "svelte-material-icons/Reload.svelte";
    import Translatable from "../../Translatable.svelte";
    import type { ConversionToken } from "./walletState.svelte";
    import BalanceActions from "./BalanceActions.svelte";

    interface Props {
        selectedConversion: ConversionToken;
        refreshingWallet: boolean;
        onRefreshWallet: () => void;
    }

    let { selectedConversion, refreshingWallet, onRefreshWallet }: Props = $props();

    function calculateTotal(
        accounts: EnhancedTokenDetails[],
        conversion: "usd" | "icp" | "btc" | "eth",
    ): string {
        switch (conversion) {
            case "usd":
                return sum(accounts.map((c) => c.dollarBalance ?? 0)).toFixed(2);
            case "icp":
                return sum(accounts.map((c) => c.icpBalance ?? 0)).toFixed(3);
            case "btc":
                return sum(accounts.map((c) => c.btcBalance ?? 0)).toFixed(6);
            case "eth":
                return sum(accounts.map((c) => c.ethBalance ?? 0)).toFixed(6);
        }
    }

    let total = $derived(calculateTotal($accountsSorted, selectedConversion));
</script>

<Container padding={["md", "lg"]} crossAxisAlignment={"center"} direction={"vertical"} gap={"xl"}>
    <Container crossAxisAlignment={"center"} direction={"vertical"} overflow="visible" gap="sm">
        <Subtitle width={"hug"} fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Total balance")} />
        </Subtitle>
        <Row gap="md" overflow="visible">
            <Row width="fill">
                <div></div>
            </Row>
            <Row width="hug" overflow="visible">
                <H1 blur={$hideTokenBalances} width={"hug"} fontWeight={"bold"}>
                    {selectedConversion === "usd" ? "$" : ""}
                    {total}
                </H1>
            </Row>
            <Row width="fill" height="fill" crossAxisAlignment="center" gap="xs">
                <IconButton size="md" onclick={hideTokenBalances.toggle}>
                    {#snippet icon()}
                        {#if $hideTokenBalances}
                            <EyeOff color={ColourVars.textSecondary} />
                        {:else}
                            <Eye color={ColourVars.textSecondary} />
                        {/if}
                    {/snippet}
                </IconButton>

                {#if refreshingWallet}
                    <Container width={{ size: "2.5rem" }} mainAxisAlignment="center">
                        <Spinner
                            size="1.25rem"
                            backgroundColour={ColourVars.textTertiary}
                            foregroundColour={ColourVars.textSecondary} />
                    </Container>
                {:else}
                    <IconButton size="md" onclick={onRefreshWallet}>
                        {#snippet icon()}
                            <Reload color={ColourVars.textSecondary} />
                        {/snippet}
                    </IconButton>
                {/if}
            </Row>
        </Row>
    </Container>
    <BalanceActions {selectedConversion} />
</Container>
