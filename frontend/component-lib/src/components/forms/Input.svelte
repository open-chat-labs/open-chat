<script lang="ts">
    import { Caption, ColourVars, Container, type Padding } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        id?: string;
        value?: string;
        placeholder?: string;
        subtext?: Snippet;
        error?: boolean;
        minlength?: number;
        maxlength?: number;
        countdown?: boolean;
        icon?: Snippet<[string]>;
        iconButtons?: Snippet<[string]>;
        textButtons?: Snippet;
        disabled?: boolean;
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
        icon,
        iconButtons,
        textButtons,
        disabled = false,
    }: Props = $props();

    let remaining = $derived(maxlength - (value?.length ?? 0));
    let warn = $derived(remaining <= 5);
    let hasButtons = $derived(iconButtons || textButtons);
    let padding = $derived<Padding>(hasButtons ? ["xs", "xs", "xs", "md"] : ["xs", "xl"]);
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container
        background={ColourVars.textTertiary}
        height={{ kind: "fixed", size: "3rem" }}
        {padding}
        borderRadius={"circle"}
        gap={"sm"}
        crossAxisAlignment={"center"}>
        <input
            class:disabled
            {disabled}
            data-gram="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            spellcheck="false"
            {minlength}
            {maxlength}
            required={minlength > 0}
            {id}
            bind:value
            {placeholder} />

        {#if countdown}
            <div class:warn class="countdown">{remaining}</div>
        {/if}
        {#if icon}
            <div class="input_icon">
                {@render icon(ColourVars.textSecondary)}
            </div>
        {/if}
        {#if iconButtons}
            <Container width={{ kind: "hug" }} gap={"xs"}>
                {@render iconButtons(ColourVars.textPrimary)}
            </Container>
        {/if}
        {#if textButtons}
            <Container width={{ kind: "hug" }} gap={"xs"}>
                {@render textButtons()}
            </Container>
        {/if}
    </Container>
    {#if subtext}
        <div class="subtext">
            <Caption colour={error ? "error" : "textSecondary"}>
                {@render subtext()}
            </Caption>
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.input_icon svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    .input_icon {
        all: unset;
        display: flex;
    }

    input {
        all: unset;
        width: 100%;
        color: var(--text-secondary);
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);

        &::placeholder {
            color: var(--text-placeholder);
        }
    }

    .subtext {
        padding-inline-start: var(--sp-xl);
    }

    .countdown {
        color: var(--text-secondary);
        &.warn {
            color: var(--warning);
        }
    }
</style>
