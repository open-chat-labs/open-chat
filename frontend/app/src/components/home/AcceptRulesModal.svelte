<script lang="ts">
    import {
        type OpenChat,
        app,
        currentChatRules,
        captureRulesAcceptanceStore as rulesAcceptanceStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import AreYouSure from "../AreYouSure.svelte";

    const client = getContext<OpenChat>("client");

    function onAction(accepted: boolean): Promise<void> {
        $rulesAcceptanceStore?.resolve(accepted);
        return Promise.resolve();
    }
</script>

<AreYouSure
    title={i18nKey("rules.acceptTitle")}
    message={i18nKey(
        client.combineRulesText($currentChatRules, app.selectedCommunityDetails.rules),
    )}
    yesLabel={i18nKey("rules.accept")}
    noLabel={i18nKey("rules.reject")}
    action={onAction} />
