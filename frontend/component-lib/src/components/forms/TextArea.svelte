<script lang="ts">
    import { Caption, ColourVars, Container } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        id?: string;
        value?: string;
        placeholder?: string;
        subtext?: Snippet;
        error?: Snippet;
        minlength?: number;
        maxlength?: number;
        countdown?: boolean;
        rows?: number;
    }

    let {
        id,
        value = $bindable(),
        placeholder,
        subtext,
        error,
        minlength = 0,
        maxlength = 10000,
        countdown = false,
        rows = 4,
    }: Props = $props();

    let remaining = $derived(maxlength - (value?.length ?? 0));
    let warn = $derived(remaining <= 5);
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container
        background={ColourVars.textTertiary}
        padding={["md", "xl", "xs", "xl"]}
        borderRadius={"xxl"}
        gap={"sm"}
        crossAxisAlignment={"start"}>
        <textarea
            data-gram="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            spellcheck="false"
            {rows}
            {minlength}
            {maxlength}
            required={minlength > 0}
            {id}
            bind:value
            {placeholder}></textarea>

        {#if countdown}
            <div class:warn class="countdown">{remaining}</div>
        {/if}
    </Container>
    {#if subtext}
        <div class="subtext">
            <Caption colour={"textSecondary"}>
                {@render subtext()}
            </Caption>
        </div>
    {/if}
    {#if error}
        <div class="subtext">
            <Caption colour={"error"}>
                {@render error()}
            </Caption>
        </div>
    {/if}
</Container>

<style lang="scss">
    textarea {
        all: unset;
        width: 100%;
        color: var(--text-secondary);

        &::placeholder {
            color: var(--text-placeholder);
        }
    }

    .subtext {
        padding-inline-start: var(--sp-xl);
    }

    .countdown {
        position: absolute;
        top: var(--sp-md);
        right: var(--sp-xl);
        color: var(--text-secondary);
        &.warn {
            color: var(--warning);
        }
    }
</style>
