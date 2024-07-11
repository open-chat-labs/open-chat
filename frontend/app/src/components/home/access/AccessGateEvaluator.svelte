<script lang="ts">
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
</script>

<Overlay>
    <ModalContent closeIcon on:close>
        <div slot="header">
            <Translatable resourceKey={i18nKey("Whatevs")} />
        </div>
        <div class="body access-gate-evaluator" slot="body">stuff</div>

        <div let:onClose slot="footer">
            <ButtonGroup>
                <Button on:click={onClose}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
</style>
