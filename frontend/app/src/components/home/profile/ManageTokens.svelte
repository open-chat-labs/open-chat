<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Button from "../../Button.svelte";

    const dispatch = createEventDispatcher();
</script>

<div class="tokens">We'll put all the tokens in here and each one will have a toggle</div>

<Button on:click={() => dispatch("close")}>Done</Button>

<style lang="scss">
</style>
