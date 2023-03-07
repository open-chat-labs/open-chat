<script lang="ts">
    import ButtonGroup from "../../ButtonGroup.svelte";

    export let align: "end" | "fill" | "center" = "end";
</script>

<div class="footer">
    <ButtonGroup {align}>
        <slot />
    </ButtonGroup>
</div>

<style type="text/scss">
    .footer {
        padding: $sp4 $sp5;
        position: relative;

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }
</style>
