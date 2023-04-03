<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import Markdown from "./Markdown.svelte";
    import { _ } from "svelte-i18n";
    import { shownAirdropPrompt } from "../../stores/settings";
    import Input from "../Input.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { toastStore } from "stores/toast";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { Confetti } from "svelte-confetti";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: eligibleForInitialAirdrop = client.eligibleForInitialAirdrop;

    let busy = false;
    let principal = "";
    let showHow = false;
    let tada = false;
    let cutoffDate = new Date(1681516800000);

    onMount(() => {
        shownAirdropPrompt.set(true);
        if ($eligibleForInitialAirdrop.kind === "user_eligible") {
            principal = $eligibleForInitialAirdrop.principal ?? "";
        }
    });

    function record() {
        busy = true;
        client
            .setNeuronControllerForInitialAirdrop(principal)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast($_("airdrop.success"));
                    tada = true;
                    setTimeout(() => dispatch("close"), 2000);
                } else {
                    toastStore.showFailureToast($_("airdrop.failure"));
                }
            })
            .finally(() => (busy = false));
    }
</script>

<ModalContent compactFooter fill closeIcon on:close>
    <div slot="header">
        <h1>{$_("airdrop.register")}</h1>
    </div>
    <div class="body" class:showHow slot="body">
        {#if tada}
            <div class="confetti">
                <Confetti />
            </div>
        {/if}
        {#if showHow}
            <img class="how-to" src="../assets/show_how.gif" />
        {:else}
            <p class="para">
                <Markdown
                    text={$_("airdrop.pleaseSubmit", {
                        values: { cutoff: client.toDatetimeString(cutoffDate) },
                    })} />
            </p>
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
        {/if}
    </div>
    <div slot="footer">
        <ButtonGroup>
            {#if showHow}
                <Button
                    on:click={() => (showHow = false)}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    {$_("airdrop.back")}
                </Button>
            {:else}
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
                    disabled={principal.length === 0 ||
                        ($eligibleForInitialAirdrop.kind === "user_eligible" &&
                            $eligibleForInitialAirdrop.principal === principal)}
                    on:click={record}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    {$_("airdrop.submit")}
                </Button>
            {/if}
        </ButtonGroup>
    </div>
</ModalContent>

<style type="text/scss">
    .para,
    .input {
        margin-bottom: $sp5;
    }

    .body {
        padding: $sp4 $sp5;
        position: relative;

        &.showHow {
            padding: 0;
        }
    }

    .how-to {
        width: 100%;
    }

    .confetti {
        position: absolute;
        pointer-events: none;
        top: 50%;
        left: 50%;
    }
</style>
