<script lang="ts">
    import { BodySmall, ColourVars, Container, type Padding } from "component-lib";
    import { onMount, type Snippet } from "svelte";

    interface Props {
        id?: string;
        value?: string | number | bigint;
        placeholder?: string;
        subtext?: Snippet;
        error?: boolean;
        min?: number;
        max?: number;
        icon?: Snippet<[string]>;
        iconButtons?: Snippet<[string]>;
        textButtons?: Snippet;
        unitText?: string;
        disabled?: boolean;
        autofocus?: boolean;
        step?: number;
        maxDecimals?: number;
    }

    let {
        id,
        value = $bindable(),
        placeholder,
        subtext,
        error,
        min,
        max,
        icon,
        iconButtons,
        textButtons,
        unitText,
        disabled = false,
        autofocus = false,
        step = 1,
        maxDecimals,
    }: Props = $props();

    let hasInternalButtons = $derived(textButtons);
    let padding = $derived<Padding>(hasInternalButtons ? ["xs", "xs", "xs", "md"] : ["xs", "xl"]);
    let inp: HTMLInputElement;

    onMount(() => {
        if (autofocus) {
            inp?.focus();
        }
    });

    $effect(() => {
        if (value) {
            const cleaned = trimDecimals(
                value
                    .toString()
                    .replace(/[^0-9.]/g, "") // Remove everything except digits and dots
                    .replace(/(\..*)\./g, "$1"), // Allow only the first dot
            );

            if (value !== cleaned) {
                value = cleaned;
            }
        }
    });

    function trimDecimals(value: string): string {
        if (maxDecimals && maxDecimals > 0) {
            const fractional = value.split(".")[1];

            if (fractional !== undefined) {
                const toTrim = fractional.length - maxDecimals;
                if (toTrim > 0) {
                    return value.substring(0, value.length - toTrim);
                }
            }
        }

        return value;
    }
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container mainAxisAlignment={"spaceBetween"} gap={"sm"}>
        <Container
            background={ColourVars.textTertiary}
            minHeight="3.5rem"
            {padding}
            borderRadius={"circle"}
            gap={"sm"}
            crossAxisAlignment={"center"}>
            <input
                type="text"
                inputmode="decimal"
                bind:this={inp}
                bind:value
                class:disabled
                pattern={"[0-9]*"}
                data-gram="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                data-lpignore="true"
                spellcheck="false"
                {disabled}
                {min}
                {max}
                {id}
                {step}
                {placeholder} />

            {#if unitText}
                <Container width={"hug"}>
                    <BodySmall fontWeight="bold" colour="textSecondary">{unitText}</BodySmall>
                </Container>
            {/if}
            {#if icon}
                <div class="input_icon">
                    {@render icon(ColourVars.textSecondary)}
                </div>
            {/if}
            {#if textButtons}
                <Container width={"hug"} gap={"xs"}>
                    {@render textButtons()}
                </Container>
            {/if}
            {#if error}
                <Container width="hug" padding="xs">
                    <div class="error_indicator"></div>
                </Container>
            {/if}
        </Container>
        {#if iconButtons}
            <Container width={"hug"} gap={"xs"}>
                {@render iconButtons(ColourVars.textPrimary)}
            </Container>
        {/if}
    </Container>
    {#if subtext}
        <div class="subtext">
            <BodySmall colour={error ? "error" : "textSecondary"}>
                {@render subtext()}
            </BodySmall>
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
        color: var(--text-primary);
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);

        &::placeholder {
            color: var(--text-placeholder);
        }
    }

    .subtext {
        padding-inline-start: var(--sp-xl);
        padding-inline-end: var(--sp-xl);
    }

    .error_indicator {
        display: block;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: var(--rad-sm);
        background-color: var(--error);
        transform: rotate(45deg);
    }

    /* Chrome, Safari, Edge, Opera */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    input[type="number"] {
        -moz-appearance: textfield;
    }
</style>
