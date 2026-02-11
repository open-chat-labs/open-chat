<script lang="ts">
    import { BodySmall, Row, type Padding } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import Translatable from "./Translatable.svelte";

    interface Props {
        label: ResourceKey;
        rules?: ResourceKey | undefined;
        required?: boolean;
        large?: boolean;
        padding?: Padding;
    }

    let {
        label,
        rules = undefined,
        required = false,
        padding = ["zero", "xl", "xs", "xl"],
    }: Props = $props();
</script>

<Row {padding} width={"hug"} gap={"xs"} crossAxisAlignment={"center"}>
    <BodySmall width={"hug"}>
        <Translatable resourceKey={label} />
    </BodySmall>
    {#if rules}
        <BodySmall colour={"textSecondary"}>(<Translatable resourceKey={rules} />)</BodySmall>
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
