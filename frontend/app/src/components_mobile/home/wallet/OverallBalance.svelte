<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import { sum } from "@src/utils/math";
    import { BodySmall, ColourVars, CommonButton2, Container, H1, Subtitle } from "component-lib";
    import {
        type EnhancedTokenDetails,
        walletTokensSorted as accountsSorted,
    } from "openchat-client";
    import EyeOff from "svelte-material-icons/EyeOffOutline.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import Reload from "svelte-material-icons/Reload.svelte";
    import Translatable from "../../Translatable.svelte";
    import type { ConversionToken } from "./walletState.svelte";

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

<Container padding={["md", "lg"]} crossAxisAlignment={"center"} direction={"vertical"} gap={"lg"}>
    <!-- Balance -->
    <Container crossAxisAlignment={"center"} direction={"vertical"} overflow="visible">
        <BodySmall width={"hug"} fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("Total balance")} />
        </BodySmall>
        <H1 blur={$hideTokenBalances} width={"hug"} fontWeight={"bold"}>
            {selectedConversion === "usd" ? "$" : ""}
            {total}
        </H1>
    </Container>
    <!-- Buttons -->
    <Container
        mainAxisAlignment={"center"}
        crossAxisAlignment={"center"}
        padding={["sm", "zero"]}
        borderColour={ColourVars.background2}
        borderWidth="thick"
        borderRadius="md">
        <CommonButton2 onClick={onRefreshWallet} loading={refreshingWallet} width="fill">
            {#snippet icon(color, size)}
                <Reload {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Refresh wallet")} />
        </CommonButton2>
        <Subtitle width={"hug"} colour="textTertiary" fontWeight="bold">/</Subtitle>
        <CommonButton2 onClick={hideTokenBalances.toggle} width="fill">
            {#snippet icon(color, size)}
                {#if $hideTokenBalances}
                    <EyeOff {color} {size} />
                {:else}
                    <Eye {color} {size} />
                {/if}
            {/snippet}
            <Translatable
                resourceKey={i18nKey($hideTokenBalances ? "Show balances" : "Hide balances")} />
        </CommonButton2>
    </Container>
</Container>
