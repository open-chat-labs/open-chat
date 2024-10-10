<script lang="ts">
    import ModalContent from "../../ModalContent.svelte";
</script>

<ModalContent on:close hideHeader hideFooter fadeDelay={0} fadeDuration={0}>
    <div slot="body">
        <slot />
    </div>
</ModalContent>
