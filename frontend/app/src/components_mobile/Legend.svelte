<script lang="ts">
    import { Body, BodySmall, Row } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import Translatable from "./Translatable.svelte";

    interface Props {
        label: ResourceKey;
        rules?: ResourceKey | undefined;
        required?: boolean;
        large?: boolean;
    }

    let { label, rules = undefined, required = false }: Props = $props();
</script>

<Row width={"hug"} gap={"xs"} crossAxisAlignment={"center"}>
    <Body width={"hug"}>
        <Translatable resourceKey={label} />
    </Body>
    {#if rules}
        <BodySmall>(<Translatable resourceKey={rules} />)</BodySmall>
    {/if}
    {#if required}
        <span class="required">*</span>
    {/if}
</Row>

<style lang="scss">
    .required {
        color: var(--error);
    }
</style>
