<script lang="ts">
    import { CURRENT_TERMS_VERSION, currentUserStore, type OpenChat } from "@client";
    import { Body, Button, Column, H2, Sheet } from "component-lib";
    import { getContext } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let busy = $state(false);

    // Deliberately undismissible: the only way past is the affirmative accept, which is
    // recorded (with version and timestamp) against the user record. Accept the version the
    // canister reports (the same one the notice is gated on) rather than the frontend
    // constant - otherwise a canister ahead of the website would accept a version below the
    // gate, leaving this undismissible sheet permanently open.
    function accept() {
        if (busy) return;
        busy = true;
        client
            .acceptTerms($currentUserStore.currentTermsVersion ?? CURRENT_TERMS_VERSION)
            .finally(() => (busy = false));
    }
</script>

<Sheet onDismiss={() => undefined}>
    <Column crossAxisAlignment={"center"} gap={"xl"} padding={"xl"}>
        <H2 width={"hug"} fontWeight={"bold"} colour={"primary"}>
            <Translatable resourceKey={i18nKey("termsUpdated.title")} />
        </H2>
        <Body><Translatable resourceKey={i18nKey("termsUpdated.info")} /></Body>
        <Body>
            <a href="/terms" target="_blank" rel="noreferrer noopener">
                <Translatable resourceKey={i18nKey("termsUpdated.link")} />
            </a>
        </Body>
        <Button loading={busy} disabled={busy} onClick={accept}>
            <Translatable resourceKey={i18nKey("termsUpdated.agree")} />
        </Button>
    </Column>
</Sheet>
