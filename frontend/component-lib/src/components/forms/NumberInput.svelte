<script lang="ts">
    import { Caption, ColourVars, Container, type Padding } from "component-lib";
    import { onMount, type Snippet } from "svelte";

    interface Props {
        id?: string;
        value?: number;
        placeholder?: string;
        subtext?: Snippet;
        error?: boolean;
        min?: number;
        max?: number;
        icon?: Snippet<[string]>;
        iconButtons?: Snippet<[string]>;
        textButtons?: Snippet;
        disabled?: boolean;
        autofocus?: boolean;
    }

    let {
        id,
        value = $bindable(),
        placeholder,
        subtext,
        error,
        min = 0,
        max = 10000,
        icon,
        iconButtons,
        textButtons,
        disabled = false,
        autofocus = false,
    }: Props = $props();

    let hasInternalButtons = $derived(textButtons);
    let padding = $derived<Padding>(hasInternalButtons ? ["xs", "xs", "xs", "md"] : ["xs", "xl"]);
    let inp: HTMLInputElement;

    onMount(() => {
        if (autofocus) {
            inp?.focus();
        }
    });

    function clamp(val: number): number | undefined {
        if (isNaN(val)) return undefined;
        if (val > max) return max;
        if (val < min) return min;
        return val;
    }

    function handleInput(e: { currentTarget: { value: string } }) {
        if (inp) {
            value = clamp(parseInt(e.currentTarget.value, 10));
            if (value !== undefined) {
                inp.value = value.toString();
            }
        }
    }
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container mainAxisAlignment={"spaceBetween"} gap={"xs"}>
        <Container
            background={ColourVars.textTertiary}
            height={{ size: "3rem" }}
            {padding}
            borderRadius={"circle"}
            gap={"sm"}
            crossAxisAlignment={"center"}>
            <input
                bind:this={inp}
                class:disabled
                oninput={handleInput}
                {disabled}
                pattern={"[0-9]*"}
                data-gram="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                data-lpignore="true"
                spellcheck="false"
                {value}
                {min}
                {max}
                {id}
                {placeholder} />

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
        </Container>
        {#if iconButtons}
            <Container width={"hug"} gap={"xs"}>
                {@render iconButtons(ColourVars.textPrimary)}
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
        padding-inline-end: var(--sp-xl);
    }

    .countdown {
        color: var(--text-secondary);
        &.warn {
            color: var(--warning);
        }
    }
</style>
