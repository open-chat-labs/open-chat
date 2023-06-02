<script lang="ts">
    import Button from "./Button.svelte";
</script>

<div class="reload">
    <slot />
    <div class="btn">
        <Button on:click={() => window.location.reload()}>Reload</Button>
    </div>
</div>

<style lang="scss">
    .reload {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        @include font(bold, normal, fs-120);
        padding: $sp5;

        .btn {
            margin-top: $sp5;
        }
    }
</style>
