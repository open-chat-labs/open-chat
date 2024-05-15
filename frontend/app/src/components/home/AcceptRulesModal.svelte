<script lang="ts">
    import AreYouSure from "../AreYouSure.svelte";
    import { getContext } from "svelte";
    import { type OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    let currentChatRules = client.currentChatRules;
    let currentCommunityRules = client.currentCommunityRules;

    $: rulesAcceptanceStore = client.captureRulesAcceptanceStore;

    function onAction(accepted: boolean): Promise<void> {
        $rulesAcceptanceStore?.resolve(accepted);
        return Promise.resolve();
    }
</script>

<AreYouSure
    title={i18nKey("rules.acceptTitle")}
    message={i18nKey(client.combineRulesText($currentChatRules, $currentCommunityRules))}
    yesLabel={i18nKey("rules.accept")}
    noLabel={i18nKey("rules.reject")}
    action={onAction} />
