<script lang="ts">
    import { ColourVars, Container, Spinner } from "component-lib";
    import Close from "svelte-material-icons/Close.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";

    interface Props {
        id?: string;
        value?: string;
        placeholder?: string;
        onSearch?: (val?: string) => void;
        onClear?: () => void;
        searching?: boolean;
        debounceDuration?: number;
    }

    let {
        id,
        value = $bindable(),
        placeholder,
        onSearch,
        onClear,
        searching = false,
        debounceDuration = 300,
    }: Props = $props();
    let timer: number | undefined;

    function keydown(ev: KeyboardEvent) {
        if (["Up", "Down", "Left", "Right", "Tab"].includes(ev.key)) {
            return;
        }
        if (ev.key === "Escape") {
            value = undefined;
        }
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            onSearch?.(value);
        }, debounceDuration);
    }
</script>

<Container
    background={ColourVars.textTertiary}
    padding={"lg"}
    borderRadius={"circle"}
    gap={"lg"}
    crossAxisAlignment={"center"}>
    <div class="search_icon">
        <Magnify color={ColourVars.textPlaceholder} />
    </div>
    <input
        autocomplete="off"
        data-gram="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        data-lpignore="true"
        spellcheck="false"
        {id}
        onkeydown={keydown}
        bind:value
        {placeholder} />
    {#if searching}
        <Spinner
            size={"1.4rem"}
            backgroundColour={ColourVars.textTertiary}
            foregroundColour={ColourVars.textSecondary} />
    {:else if value !== undefined && value !== ""}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="close" onclick={onClear}>
            <Close color={ColourVars.textPlaceholder} />
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.search_icon svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    .search_icon,
    .close {
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
</style>
