<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../ModalContent.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import Legend from "../Legend.svelte";
    import Input from "../Input.svelte";
    import TextArea from "../TextArea.svelte";
    import type { CandidateProposal } from "openchat-client";

    const MIN_TITLE_LENGTH = 3;
    const MAX_TITLE_LENGTH = 100;
    const MIN_URL_LENGTH = 3;
    const MAX_URL_LENGTH = 100;
    const MAX_SUMMARY_LENGTH = 1024;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let candidateProposal: CandidateProposal;
    let busy = false;
    let valid = false;

    function onClose() {
        dispatch("close");
    }

    function onSubmit() {
        if (!valid) return;

        busy = true;
        client.submitProposal(candidateProposal).then((_) => {
            busy = false;
            //dispatch("close");
        });
    }
</script>

<ModalContent closeIcon on:close>
    <div class="header" slot="header">$_("Make a proposal")</div>
    <div class="body" slot="body">
        <section>
            <Legend label={$_("proposal.title")} required />
            <Input
                autofocus
                disabled={busy}
                bind:value={candidateProposal.title}
                minlength={MIN_TITLE_LENGTH}
                maxlength={MAX_TITLE_LENGTH}
                countdown
                placeholder={$_("proposal.enterTitle")} />
        </section>
        <section>
            <Legend label={$_("proposal.url")} />
            <Input
                autofocus
                disabled={busy}
                bind:value={candidateProposal.url}
                minlength={MIN_URL_LENGTH}
                maxlength={MAX_URL_LENGTH}
                countdown
                placeholder={$_("proposal.enterUrl")} />
        </section>
        <section>
            <Legend label={$_("proposal.summary")} required />
            <TextArea
                rows={4}
                disabled={busy}
                bind:value={candidateProposal.summary}
                maxlength={MAX_SUMMARY_LENGTH}
                placeholder={$_("proposal.enterSummary")} />
        </section>
        <!-- TO_PRINCIPAL=$5
        TO_SUBACCOUNT=$6
        MEMO=$7
        AMOUNT_E8S=$8 -->
    </div>
    <span class="footer" slot="footer">
        <ButtonGroup>
            <Button disabled={!valid || !busy} tiny secondary on:click={onClose}
                >{$_("close")}</Button>
            <Button disabled={!valid || !busy} tiny on:click={onSubmit}>{$_("submit")}</Button>
        </ButtonGroup>
    </span>
</ModalContent>

<style lang="scss">
    .body {
        width: 100%;
        overflow: hidden;
        height: 550px;
        position: relative;

        @include mobile() {
            height: 400px;
        }
    }
</style>
