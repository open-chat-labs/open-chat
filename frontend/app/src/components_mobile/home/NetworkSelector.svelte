<script lang="ts">
    import { i18nKey } from "@i18n/i18n";
    import { Container, Option, Select, Subtitle } from "component-lib";
    import Translatable from "../Translatable.svelte";

    type Props = {
        networks: string[];
        selectedNetwork?: string;
    };

    let { networks, selectedNetwork = $bindable() }: Props = $props();
</script>

<Select
    onSelect={(val) => (selectedNetwork = val)}
    placeholder={"Token networks"}
    value={selectedNetwork}>
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey("Select your token transfer network")}></Translatable>
    {/snippet}
    {#snippet selectedValue(val)}
        {val}
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
                <Translatable resourceKey={i18nKey("Select token network")}></Translatable>
            </Subtitle>

            <Container supplementalClass={"binding_options"} direction={"vertical"}>
                {#each networks as network}
                    <Option
                        value={network}
                        onClick={onSelect}
                        selected={selectedNetwork === network}>
                        {network}
                    </Option>
                {/each}
            </Container>
        </Container>
    {/snippet}
</Select>
