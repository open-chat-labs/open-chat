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
        padding: $sp3;
        background-color: var(--modal-footer-bg);
        border-top: 1px solid var(--modal-footer-bd);
        position: relative;
    }
</style>
