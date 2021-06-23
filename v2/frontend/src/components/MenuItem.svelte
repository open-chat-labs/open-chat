<script lang="ts">
    export let text: string;
</script>

<div class="menu-item" on:click>
    {text}
</div>

<style type="text/scss">
    .menu-item {
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid var(--menu-bd);
        color: var(--menu-txt);
        font-size: 14px;

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background-color: var(--menu-hv);
        }
    }
</style>
