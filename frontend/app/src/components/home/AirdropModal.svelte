<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import { shownAirdropPrompt } from "../../stores/settings";
    import Input from "../Input.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "stores/toast";
    import { mobileWidth } from "../../stores/screenDimensions";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let busy = false;
    let principal = "";
    let showHow = false;

    onMount(() => shownAirdropPrompt.set(true));

    function record() {
        busy = true;
        client
            .setNeuronControllerForInitialAirdrop(principal)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast($_("airdrop.success"));
                    dispatch("close");
                } else {
                    toastStore.showFailureToast($_("airdrop.failure"));
                }
            })
            .finally(() => (busy = false));
    }
</script>

{#if showHow}
    <Overlay>
        <ModalContent compactFooter fill closeIcon on:close={() => (showHow = false)}>
            <div slot="header">
                <h1>{$_("airdrop.howTo")}</h1>
            </div>
            <div slot="body">
                <video class="how-to" controls>
                    <source src="../assets/airdrop.mp4" />
                </video>
            </div>
            <div slot="footer">
                <Button
                    on:click={() => (showHow = false)}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    {$_("back")}
                </Button>
            </div>
        </ModalContent>
    </Overlay>
{/if}

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
            <Button
                on:click={() => (showHow = true)}
                small={!$mobileWidth}
                tiny={$mobileWidth}
                secondary>
                {$_("airdrop.showHow")}
            </Button>
            <Button
                on:click={() => dispatch("close")}
                small={!$mobileWidth}
                tiny={$mobileWidth}
                secondary>
                {$_("cancel")}
            </Button>
            <Button
                disabled={principal.length === 0}
                on:click={record}
                loading={busy}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
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

    .how-to {
        width: 100%;
    }
</style>
