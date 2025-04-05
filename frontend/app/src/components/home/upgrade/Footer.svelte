<script lang="ts">
    import ButtonGroup from "../../ButtonGroup.svelte";

    interface Props {
        align?: "end" | "fill" | "center";
        children?: import("svelte").Snippet;
    }

    let { align = "end", children }: Props = $props();
</script>

<div class="footer">
    <ButtonGroup {align}>
        {@render children?.()}
    </ButtonGroup>
</div>

<style lang="scss">
    .footer {
        padding: $sp4 $sp5;
        position: relative;

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }
</style>
