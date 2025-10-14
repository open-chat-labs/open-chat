<script lang="ts">
    import { i18nKey, supportedLanguages } from "@src/i18n/i18n";
    import { Container, Option, Search, Select, Subtitle } from "component-lib";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        selected?: { name: string; code: string };
        onSelect: (val: { name: string; code: string }) => void;
        placeholder: string;
        subtext?: Snippet;
    }

    let { selected, onSelect, placeholder, subtext }: Props = $props();
    let searching = $state(false);
    let searchTerm = $state<string>();
    let filteredLanguages = $derived(
        supportedLanguages
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(
                (b) =>
                    searchTerm === undefined ||
                    searchTerm === "" ||
                    b.name.toLocaleLowerCase().includes(searchTerm?.toLocaleLowerCase()),
            ),
    );

    function internalSelect(val: { name: string; code: string }) {
        searchTerm = undefined;
        onSelect(val);
    }
</script>

<Select {subtext} onSelect={internalSelect} {placeholder} value={selected}>
    {#snippet selectedValue(val)}
        {val.name}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Container
            onClick={(e) => e?.stopPropagation()}
            height={{ kind: "fixed", size: "100%" }}
            supplementalClass={"language_options"}
            padding={"lg"}
            gap={"lg"}
            direction={"vertical"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Select language")}></Translatable>
            </Subtitle>

            <Search
                {searching}
                id={"search_component"}
                placeholder={$_("search")}
                bind:value={searchTerm} />

            <Container supplementalClass={"binding_options"} direction={"vertical"}>
                {#each filteredLanguages as lang}
                    <Option value={lang} onClick={onSelect} selected={selected?.code === lang.code}>
                        {lang.name}
                    </Option>
                {/each}
            </Container>
        </Container>
    {/snippet}
</Select>

<style lang="scss">
    // this is a bit unfortunate
    :global(.container.language_options) {
        flex: auto !important;
    }
</style>
