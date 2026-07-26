<script lang="ts">
    import { CURRENT_TERMS_VERSION, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import Button from "./Button.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let busy = $state(false);

    // Deliberately undismissible: the only way past is the affirmative accept, which is
    // recorded (with version and timestamp) against the user record
    function accept() {
        if (busy) return;
        busy = true;
        client.acceptTerms(CURRENT_TERMS_VERSION);
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
</style>
