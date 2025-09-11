<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import Magnify from "svelte-material-icons/Magnify.svelte";

    interface Props {
        id?: string;
        value?: string;
        placeholder?: string;
        onSearch?: (val?: string) => void;
        debounceDuration?: number;
    }

    let {
        id,
        value = $bindable(),
        placeholder,
        onSearch,
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
            if (value?.length ?? 0 > 0) {
                onSearch?.(value);
            }
        }, debounceDuration);
    }
</script>

<Container
    backgroundColour={ColourVars.textTertiary}
    padding={"lg"}
    borderRadius={"circle"}
    gap={"lg"}
    crossAxisAlignment={"center"}>
    <div class="search_icon">
        <Magnify color={ColourVars.textPlaceholder} />
    </div>
    <input {id} onkeydown={keydown} bind:value {placeholder} />
</Container>

<style lang="scss">
    :global(.search_icon svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    .search_icon {
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
