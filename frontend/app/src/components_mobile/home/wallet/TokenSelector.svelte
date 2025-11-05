<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import { ColourVars, Container, Option, Search, Sheet, Subtitle } from "component-lib";
    import type { EnhancedTokenDetails, ResourceKey } from "openchat-client";
    import { cryptoTokensSorted as accountsSorted } from "openchat-client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import WalletToken from "./WalletToken.svelte";

    interface Props {
        onDismiss: () => void;
        onSelect: (token: EnhancedTokenDetails) => void;
        title: ResourceKey;
        placeholder: ResourceKey;
        icon?: Snippet<[string, string]>;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
        selected?: Set<string>;
    }

    let {
        onDismiss,
        onSelect,
        title,
        icon,
        placeholder,
        extraFilter,
        selected = new Set(),
    }: Props = $props();

    let searching = $state(false);
    let searchTerm = $state<string>("");
    let searchTermLower = $derived(searchTerm?.toLowerCase());
    let filteredTokens = $derived(
        $accountsSorted.filter(
            (token) =>
                token.enabled &&
                (extraFilter === undefined || extraFilter(token)) &&
                (searchTermLower === "" ||
                    token.name.toLowerCase().includes(searchTermLower) ||
                    token.symbol.toLowerCase().includes(searchTermLower)),
        ),
    );
</script>

<Sheet {onDismiss}>
    <Container
        height={{ kind: "fixed", size: "100%" }}
        supplementalClass={"token_selector"}
        padding={"lg"}
        gap={"xl"}
        direction={"vertical"}>
        <Container padding={["zero", "sm"]} gap={"md"} crossAxisAlignment={"center"}>
            {@render icon?.(ColourVars.textSecondary, "1.4rem")}
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={title}></Translatable>
            </Subtitle>
        </Container>

        <Search
            {searching}
            id={"search_component"}
            placeholder={interpolate($_, placeholder)}
            bind:value={searchTerm} />

        <Container gap={"sm"} supplementalClass={"token_selector"} direction={"vertical"}>
            {#each filteredTokens as token}
                <Option
                    onClick={() => onSelect(token)}
                    padding={["zero", "md", "zero", "zero"]}
                    value={token}
                    selected={selected.has(token.ledger)}>
                    <WalletToken withMenu={false} selectedConversion={"usd"} {token} />
                </Option>
            {/each}
        </Container>
    </Container>
</Sheet>

<style lang="scss">
    // this is a bit unfortunate
    :global(.container.token_selector) {
        flex: auto !important;
    }
</style>
