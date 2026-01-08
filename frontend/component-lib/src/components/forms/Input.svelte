<script lang="ts">
    import { BodySmall, Caption, ColourVars, Container, Row, type Padding } from "component-lib";
    import { onMount, type Snippet } from "svelte";

    interface Props {
        id?: string;
        value?: string | number;
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
        autofocus?: boolean;
        required?: boolean;
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
        autofocus = false,
        required = false,
    }: Props = $props();

    let remaining = $derived(maxlength - (value?.toString()?.length ?? 0));
    let warn = $derived(remaining <= 5);
    let hasInternalButtons = $derived(textButtons);
    let padding = $derived<Padding>(hasInternalButtons ? ["xs", "xs", "xs", "md"] : ["xs", "xl"]);
    let inp: HTMLInputElement;

    onMount(() => {
        if (autofocus) {
            inp?.focus();
        }
    });
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
        <Row width={"hug"} gap={"xs"} padding={["zero", "xl"]}>
            <Caption width={"hug"} colour={error ? "error" : "textSecondary"}>
                {@render subtext()}
            </Caption>
            {#if required}
                <BodySmall width={"hug"} colour={"error"}>*</BodySmall>
            {/if}
        </Row>
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

    .countdown {
        color: var(--text-secondary);
        &.warn {
            color: var(--warning);
        }
    }
</style>
