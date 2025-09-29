<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        onSubmit: () => void;
        children: Snippet;
        autocomplete?: boolean;
    }

    let { onSubmit, children, autocomplete = false }: Props = $props();

    function onsubmit(e: SubmitEvent) {
        e.preventDefault();
        onSubmit();
    }
</script>

<form autocomplete={autocomplete ? "on" : "off"} {onsubmit}>
    {@render children()}
    <input class="submit" type={"submit"} />
</form>

<style lang="scss">
    form {
        width: 100%;
    }
    input.submit {
        display: none;
    }
</style>
