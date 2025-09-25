<script lang="ts">
    import { Container } from "component-lib";
    import { iconSize, type ResourceKey } from "openchat-client";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import { translatable } from "../actions/translatable";
    import { i18nKey, interpolate } from "../i18n/i18n";

    interface Props {
        searchTerm?: string;
        searching: boolean;
        placeholder?: ResourceKey;
        inputStyle?: boolean;
        autofocus?: boolean;
        onPerformSearch?: (term: string) => void;
        onFocus?: () => void;
        onBlur?: () => void;
    }

    let {
        searchTerm = $bindable(""),
        searching = $bindable(false),
        placeholder = i18nKey("searchPlaceholder"),
        inputStyle = false,
        onPerformSearch,
        onFocus,
        onBlur,
        autofocus = false,
    }: Props = $props();

    let timer: number | undefined;
    let inp: HTMLInputElement;

    function performSearch(e: Event) {
        e.preventDefault();
        window.clearTimeout(timer);
        onPerformSearch?.(searchTerm);
    }
    function clearSearch() {
        searchTerm = "";
        onPerformSearch?.(searchTerm);
    }
    function keydown(ev: KeyboardEvent) {
        if (["Up", "Down", "Left", "Right", "Tab"].includes(ev.key)) {
            return;
        }
        if (ev.key === "Escape") {
            searchTerm = "";
        }
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            if (searchTerm.length != 1) {
                onPerformSearch?.(searchTerm);
            }
        }, 300);
    }

    onMount(() => {
        if (autofocus) {
            inp.focus();
        }
    });
</script>

<Container padding={["sm", "md"]}>
    <form onsubmit={performSearch} class="wrapper" class:input-style={inputStyle}>
        <input
            bind:this={inp}
            onkeydown={keydown}
            spellcheck="false"
            bind:value={searchTerm}
            type="text"
            class:input-style={inputStyle}
            use:translatable={{ key: placeholder }}
            placeholder={interpolate($_, placeholder)}
            onfocus={onFocus}
            onblur={onBlur} />
        {#if searchTerm !== ""}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span onclick={clearSearch} class="icon close" class:input-style={inputStyle}
                ><Close
                    viewBox={inputStyle ? "0 -3 24 24" : "0 0 24 24"}
                    size={$iconSize}
                    color={"var(--icon-txt)"} /></span>
        {:else}
            <span class="icon" class:searching class:input-style={inputStyle}>
                {#if !searching}
                    <Magnify
                        viewBox={inputStyle ? "0 -3 24 24" : "0 0 24 24"}
                        size={$iconSize}
                        color={"var(--icon-txt)"} />
                {/if}
            </span>
        {/if}
    </form>
</Container>

<style lang="scss">
    .wrapper {
        background-color: var(--chatSearch-bg);
        display: flex;
        align-items: center;
        position: relative;
        border-radius: var(--rd);
        box-shadow: var(--chatSearch-sh);
        border: var(--bw) solid var(--chatSearch-bd);
        border-radius: var(--chatSearch-rd);
        width: 100%;

        &.input-style {
            padding: $sp3 $sp4;
            border-radius: var(--rd);
        }
    }
    .icon {
        margin-top: $sp3;
        flex: 0 0 25px;

        &.input-style {
            margin-top: 0;
        }
    }
    .close {
        cursor: pointer;
    }
    .searching {
        @include loading-spinner(1em, 0.5em, var(--button-spinner));
    }
    input {
        background-color: transparent;
        color: var(--txt);
        outline: none;
        flex: 1;
        padding: $sp3;
        margin: 0;
        border: none;
        width: 100%;
        @include font(book, normal, fs-100);

        &.input-style {
            padding: 0;
        }

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>
