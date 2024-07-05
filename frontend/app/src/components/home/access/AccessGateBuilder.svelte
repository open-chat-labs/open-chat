<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
</script>

<Overlay>
    <ModalContent>
        <div slot="header">Create an access gate</div>
        <div slot="body">
            Create or edit the access gate whether it is a leaf gate or a composite gate
        </div>
        <div slot="footer">footer</div>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
