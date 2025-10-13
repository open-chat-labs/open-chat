<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import type { GateBinding } from "@src/utils/access";
    import { Container, Option, Search, Select, Subtitle } from "component-lib";
    import { _ } from "svelte-i18n";
    import Translatable from "../../../Translatable.svelte";

    interface Props {
        bindings: GateBinding[];
        onSelect: (b: GateBinding) => void;
        placeholder: string;
        title: string;
        selectedBinding: GateBinding;
    }

    let { bindings, onSelect, placeholder, title, selectedBinding = $bindable() }: Props = $props();

    let searching = $state(false);
    let searchTerm = $state<string>();
    let filteredBindings = $derived(
        bindings
            .sort((a, b) => a.label.localeCompare(b.label))
            .filter(
                (b) =>
                    searchTerm === undefined ||
                    searchTerm === "" ||
                    b.label.toLocaleLowerCase().includes(searchTerm?.toLocaleLowerCase()),
            ),
    );
</script>

<Select
    onSelect={(val) => {
        selectedBinding = val;
        onSelect(val);
    }}
    {placeholder}
    value={selectedBinding}>
    {#snippet selectedValue(val)}
        {val.label}
    {/snippet}
    {#snippet selectOptions(onSelect)}
        <Container
            height={{ kind: "fixed", size: "100%" }}
            supplementalClass={"binding_options"}
            padding={"lg"}
            gap={"lg"}
            direction={"vertical"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(title)}></Translatable>
            </Subtitle>

            <Search
                {searching}
                id={"search_component"}
                placeholder={$_("search")}
                bind:value={searchTerm} />

            <Container supplementalClass={"binding_options"} direction={"vertical"}>
                {#each filteredBindings as g}
                    <Option
                        disabled={!g.enabled}
                        value={g}
                        onClick={onSelect}
                        selected={selectedBinding?.key === g.key}>
                        {g.label}
                    </Option>
                {/each}
            </Container>
        </Container>
    {/snippet}
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey(placeholder)}></Translatable>
    {/snippet}
</Select>

<style lang="scss">
    // this is a bit unfortunate
    :global(.container.binding_options) {
        flex: auto !important;
    }
</style>
