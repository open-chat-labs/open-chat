<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Overlay from "../Overlay.svelte";
    import { _ } from "svelte-i18n";

    export let message: string;
    export let action: (yes: boolean) => Promise<void>;

    let inProgress = false;

    function onClick(yes: boolean) {
        if (yes) {
            inProgress = true;
        }

        action(yes).finally(() => {
            inProgress = false;
        });
    }
</script>

<Overlay active={true}>
    <ModalContent fill={true}>
        <span slot="header">{$_("areYouSure")}</span>
        <span slot="body">
            <p class="confirm-msg">
                {message}
            </p>
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    loading={inProgress}
                    disabled={inProgress}
                    small={true}
                    on:click={() => onClick(true)}>{$_("yesPlease")}</Button>
                <Button
                    disabled={inProgress}
                    small={true}
                    on:click={() => onClick(false)}
                    secondary={true}>{$_("noThanks")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .confirm-msg {
        padding: $sp5;
    }
</style>
