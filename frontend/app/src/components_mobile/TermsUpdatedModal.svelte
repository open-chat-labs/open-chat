<script lang="ts">
    import { CURRENT_TERMS_VERSION, type OpenChat } from "@client";
    import { Body, Button, Column, H2, Sheet } from "component-lib";
    import { getContext } from "svelte";
    import { i18nKey } from "../i18n/i18n";
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
