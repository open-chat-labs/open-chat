<script lang="ts">
    import { Caption, ColourVars, Container, type Padding } from "component-lib";
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
        icon?: Snippet<[string]>;
        iconButtons?: Snippet<[string]>;
        textButtons?: Snippet;
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
    }: Props = $props();

    let remaining = $derived(maxlength - (value?.length ?? 0));
    let warn = $derived(remaining <= 5);
    let hasButtons = $derived(iconButtons || textButtons);
    let padding = $derived<Padding>(hasButtons ? ["xs", "xs", "xs", "md"] : ["xs", "md"]);
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container
        backgroundColour={ColourVars.textTertiary}
        height={{ kind: "fixed", size: "3rem" }}
        {padding}
        borderRadius={"sm"}
        gap={"sm"}
        crossAxisAlignment={"center"}>
        <input
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
        <div class="testing">
            <something></something>
        </div>
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
            <Caption colour={"secondary"}>
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

        &::placeholder {
            color: var(--text-placeholder);
        }
    }

    .subtext {
        padding-inline-start: var(--sp-md);
    }

    .countdown {
        color: var(--text-secondary);
        &.warn {
            color: var(--warning);
        }
    }
</style>
