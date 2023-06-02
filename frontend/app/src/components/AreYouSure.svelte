<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Overlay from "./Overlay.svelte";
    import { _ } from "svelte-i18n";
    import Input from "./Input.svelte";
    import Markdown from "./home/Markdown.svelte";

    export let message: string;
    export let action: (yes: boolean) => Promise<void>;
    export let doubleCheck: { challenge: string; response: string } | undefined = undefined;
    export let title: string | undefined = undefined;
    export let yesLabel: string | undefined = undefined;
    export let noLabel: string | undefined = undefined;

    let inProgress = false;
    let response = "";

    $: canConfirm = !inProgress && (doubleCheck === undefined || response === doubleCheck.response);

    function onClick(yes: boolean) {
        if (yes) {
            inProgress = true;
        }

        action(yes).finally(() => {
            inProgress = false;
        });
    }
</script>

<Overlay>
    <ModalContent>
        <span slot="header">{title ?? $_("areYouSure")}</span>
        <span slot="body">
            <Markdown inline={false} text={message} />

            {#if doubleCheck !== undefined}
                <p class="challenge">
                    <Markdown text={doubleCheck.challenge} />
                </p>
                <Input
                    invalid={false}
                    disabled={inProgress}
                    autofocus={true}
                    bind:value={response}
                    minlength={0}
                    maxlength={200}
                    countdown={false} />
            {/if}
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    disabled={inProgress}
                    small={true}
                    on:click={() => onClick(false)}
                    secondary={true}>{noLabel ?? $_("noThanks")}</Button>
                <Button
                    loading={inProgress}
                    disabled={!canConfirm}
                    small={true}
                    on:click={() => onClick(true)}>{yesLabel ?? $_("yesPlease")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .challenge {
        margin: $sp3 0;
    }
</style>
