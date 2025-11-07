<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { hideTokenBalances } from "@src/stores/settings";
    import { sum } from "@src/utils/math";
    import { Body, BodySmall, CommonButton, Container, H1 } from "component-lib";
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
        onRefreshWallet: () => void;
    }

    let { selectedConversion, onRefreshWallet }: Props = $props();

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

<Container
    padding={"lg"}
    mainAxisAlignment={"center"}
    crossAxisAlignment={"center"}
    direction={"vertical"}
    gap={"sm"}>
    <BodySmall width={{ kind: "hug" }} fontWeight={"bold"} colour={"textSecondary"}>
        <Translatable resourceKey={i18nKey("Total balance")} />
    </BodySmall>
    <H1 blur={$hideTokenBalances} width={{ kind: "hug" }} fontWeight={"bold"}>
        {selectedConversion === "usd" ? "$" : ""}
        {total}
    </H1>
    <Container mainAxisAlignment={"center"} crossAxisAlignment={"center"}>
        <CommonButton onClick={onRefreshWallet} mode={"active"} size={"small_text"}>
            {#snippet icon(color, size)}
                <Reload {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Refresh wallet")} />
        </CommonButton>
        <Body width={{ kind: "hug" }}>/</Body>
        <CommonButton onClick={hideTokenBalances.toggle} mode={"active"} size={"small_text"}>
            {#snippet icon(color, size)}
                {#if $hideTokenBalances}
                    <EyeOff {color} {size} />
                {:else}
                    <Eye {color} {size} />
                {/if}
            {/snippet}
            <Translatable
                resourceKey={i18nKey($hideTokenBalances ? "Show balances" : "Hide balances")} />
        </CommonButton>
    </Container>
</Container>
