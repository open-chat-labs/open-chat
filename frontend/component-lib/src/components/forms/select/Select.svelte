<script lang="ts" generics="T">
    import { Body, Caption, ColourVars, Container, Sheet } from "component-lib";
    import { type Snippet } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";

    let {
        value,
        disabled = false,
        error,
        subtext,
        placeholder,
        selectOptions,
        selectedValue,
        onSelect,
        onOpen,
    } = $props<{
        value?: T;
        invalid?: boolean;
        disabled?: boolean;
        margin?: boolean;
        subtext?: Snippet;
        error?: boolean;
        placeholder: string;
        selectedValue: Snippet<[T]>;
        selectOptions: Snippet<[(val: T) => void]>;
        onSelect: (val: T) => void;
        onOpen?: () => void;
    }>();

    let popupVisible = $state(false);

    $effect(() => {
        if (popupVisible) {
            onOpen?.();
        }
    });
</script>

<Container onClick={() => (popupVisible = true)} direction={"vertical"}>
    <Container
        background={ColourVars.textTertiary}
        height={{ size: "3rem" }}
        padding={["xs", "xl"]}
        borderRadius={"circle"}
        gap={"sm"}
        crossAxisAlignment={"center"}>
        {#if selectedValue !== undefined && value !== undefined}
            <Body colour={"textSecondary"}>
                {@render selectedValue(value)}
            </Body>
        {:else}
            <Body colour={"textPlaceholder"}>
                {placeholder}
            </Body>
        {/if}
        {#if !disabled}
            <div class="icon">
                <ChevronDown color={"var(--text-placeholder)"} size="1.5rem" />
            </div>
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

{#if popupVisible}
    <Sheet onDismiss={() => (popupVisible = false)}>
        {@render selectOptions((val: T) => {
            popupVisible = false;
            onSelect(val);
        })}
    </Sheet>
{/if}

<style lang="scss">
    :global(option) {
        color: var(--text-placeholder);
        font-weight: normal;
    }

    .icon {
        position: absolute;
        right: 0.7rem;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        display: flex;
    }

    .select {
        transition: border ease-in-out 300ms;
        display: block;
        color: var(--text-placeholder);
        line-height: 24px;
        width: 100%;
        max-width: 100%;
        margin: 0;
        border: none;
        -moz-appearance: none;
        -webkit-appearance: none;
        appearance: none;
        background-color: var(--text-tertiary);
    }

    .select::-ms-expand {
        display: none;
    }

    .select:focus {
        border-color: var(--bd);
        outline: none;
    }

    .subtext {
        padding-inline-start: var(--sp-xl);
    }
</style>
