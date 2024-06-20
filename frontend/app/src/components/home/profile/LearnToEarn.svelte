<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <span class="header" slot="header"> Header </span>
        <h1>Learn to earn</h1>
        <span slot="footer"> Footer </span>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
