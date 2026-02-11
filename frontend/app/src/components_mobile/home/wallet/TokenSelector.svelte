<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import { ColourVars, Container, Option, Search, Sheet, Subtitle } from "component-lib";
    import type { EnhancedTokenDetails, ResourceKey } from "openchat-client";
    import { cryptoTokensSorted } from "openchat-client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import NothingToSee from "../NothingToSee.svelte";
    import SelectTokenItem from "./SelectTokenItem.svelte";

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
        $cryptoTokensSorted.filter(
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
        height={{ size: "100%" }}
        supplementalClass={"token_selector"}
        gap={"xxl"}
        direction={"vertical"}>
        <!-- title -->
        <Container padding={["md", "xxl", "zero"]} gap={"md"} crossAxisAlignment={"center"}>
            {@render icon?.(ColourVars.textSecondary, "1.4rem")}
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={title}></Translatable>
            </Subtitle>
        </Container>

        <!-- search & list -->
        <Container direction={"vertical"} overflow="hidden" supplementalClass="token_search_select">
            <Container padding={["zero", "lg", "xs"]}>
                <Search
                    {searching}
                    id={"search_component"}
                    placeholder={interpolate($_, placeholder)}
                    bind:value={searchTerm} />
            </Container>

            <Container
                gap={"xs"}
                supplementalClass={"token_selector"}
                direction={"vertical"}
                padding={["xxl", "lg"]}>
                {#if filteredTokens.length === 0}
                    <NothingToSee
                        height={{ size: "6" }}
                        padding={"zero"}
                        reset={{ onClick: onDismiss, text: "Close" }}
                        title={"No matching tokens"}
                        subtitle={searchTerm !== ""
                            ? "Try relaxing your search criteria"
                            : "You may not have any tokens that support this operation"} />
                {:else}
                    {#each filteredTokens as token}
                        <Option
                            onClick={() => onSelect(token)}
                            padding={["zero", "md", "zero", "zero"]}
                            value={token}
                            selected={selected.has(token.ledger)}>
                            <SelectTokenItem selectedConversion={"usd"} {token} />
                        </Option>
                    {/each}
                {/if}
            </Container>
        </Container>
    </Container>
</Sheet>

<style lang="scss">
    // this is a bit unfortunate
    :global {
        .container.token_search_select,
        .container.token_selector {
            flex: 1 !important;
        }
    }
</style>
