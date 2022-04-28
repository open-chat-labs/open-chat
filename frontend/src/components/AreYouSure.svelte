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
    export let doubleCheck: { question: string; answer: string } | undefined = undefined;

    let inProgress = false;
    let answer = "";

    $: canConfirm = !inProgress && (doubleCheck === undefined || answer === doubleCheck.answer);

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
    <ModalContent>
        <span slot="header">{$_("areYouSure")}</span>
        <span slot="body">
            <p>
                {message}
            </p>

            {#if doubleCheck !== undefined}
                <p>
                    <Markdown text={doubleCheck.question} />
                </p>
                <Input
                    invalid={false}
                    disabled={inProgress}
                    autofocus={true}
                    bind:value={answer}
                    minlength={0}
                    maxlength={200}
                    countdown={false} />
            {/if}
        </span>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    loading={inProgress}
                    disabled={!canConfirm}
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
    p {
        margin-bottom: $sp4;
    }
</style>
