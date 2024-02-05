<script lang="ts">
    import AreYouSure from "../AreYouSure.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { type OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    let currentChatRules = client.currentChatRules;
    let currentCommunityRules = client.currentCommunityRules;
    let chatRulesEnabled = $currentChatRules?.enabled ?? false;
    let communityRulesEnabled = $currentCommunityRules?.enabled ?? false;

    function onAction(accepted: boolean): Promise<void> {
        let chatRulesVersion = undefined;
        let communityRulesVersion = undefined;

        if (accepted) {
            if (chatRulesEnabled) {
                chatRulesVersion = $currentChatRules?.version;
                client.markChatRulesAcceptedLocally(true);
            }
            if (communityRulesEnabled) {
                communityRulesVersion = $currentCommunityRules?.version;
                client.markCommunityRulesAcceptedLocally(true);
            }
        }

        dispatch("close", { accepted, chatRulesVersion, communityRulesVersion });

        return Promise.resolve();
    }
</script>

<AreYouSure
    title={i18nKey("rules.acceptTitle")}
    message={i18nKey(client.combineRulesText($currentChatRules, $currentCommunityRules))}
    yesLabel={i18nKey("rules.accept")}
    noLabel={i18nKey("rules.reject")}
    action={onAction} />
