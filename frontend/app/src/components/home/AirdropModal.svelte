<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { shownAirdropPrompt } from "../../stores/settings";
    import Input from "../Input.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "stores/toast";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let busy = false;
    let principal = "";

    function record() {
        busy = true;
        client
            .setNeuronControllerForInitialAirdrop(principal)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast($_("airdrop.success"));
                    shownAirdropPrompt.set(true);
                } else {
                    toastStore.showFailureToast($_("airdrop.failure"));
                }
            })
            .finally(() => (busy = false));
    }
</script>

<ModalContent closeIcon on:close>
    <div slot="header">
        <h1>{$_("airdrop.register")}</h1>
    </div>
    <div slot="body">
        <p class="para">{$_("airdrop.pleaseSubmit")}</p>
        <p class="para">{$_("airdrop.info")}</p>
        <div class="input">
            <Input
                bind:value={principal}
                disabled={busy}
                autofocus={true}
                minlength={0}
                maxlength={63}
                countdown={false}
                placeholder={$_("airdrop.placeholder")} />
        </div>
    </div>
    <div slot="footer">
        <ButtonGroup>
            <Button on:click={() => dispatch("close")} small secondary>
                {$_("cancel")}
            </Button>
            <Button disabled={principal.length === 0} on:click={record} loading={busy} small>
                {$_("airdrop.submit")}
            </Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style type="text/scss">
    .para,
    .input {
        margin-bottom: $sp5;
    }
</style>
