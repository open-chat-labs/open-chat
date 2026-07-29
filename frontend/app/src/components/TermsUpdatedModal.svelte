<script lang="ts">
    import { CURRENT_TERMS_VERSION, currentUserStore, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import Button from "./Button.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let busy = $state(false);
    let failed = $state(false);

    // Deliberately undismissible: the only way past is the affirmative accept, which is
    // recorded (with version and timestamp) against the user record. Accept the version the
    // canister reports (the same one the notice is gated on) rather than the frontend
    // constant - otherwise a canister ahead of the website would accept a version below the
    // gate, leaving this undismissible modal permanently open. The modal only closes when
    // the acceptance is recorded server-side (the store is patched on success).
    function accept() {
        if (busy) return;
        busy = true;
        failed = false;
        client
            .acceptTerms($currentUserStore.currentTermsVersion ?? CURRENT_TERMS_VERSION)
            .then((success) => (failed = !success))
            .finally(() => (busy = false));
    }
</script>

<ModalContent hideHeader={false}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("termsUpdated.title")} />
    {/snippet}
    {#snippet body()}
        <div class="terms-updated">
            <p><Translatable resourceKey={i18nKey("termsUpdated.info")} /></p>
            <p>
                <a href="/terms" target="_blank" rel="noreferrer noopener">
                    <Translatable resourceKey={i18nKey("termsUpdated.link")} />
                </a>
            </p>
            {#if failed}
                <p class="failed"><Translatable resourceKey={i18nKey("termsUpdated.failed")} /></p>
            {/if}
            <Button loading={busy} disabled={busy} onClick={accept}>
                <Translatable resourceKey={i18nKey("termsUpdated.agree")} />
            </Button>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .terms-updated {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .failed {
        color: var(--error);
    }
</style>
