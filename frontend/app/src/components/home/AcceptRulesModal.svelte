<script lang="ts">
    import { _ } from "svelte-i18n";
    import AreYouSure from "../AreYouSure.svelte";
    import { getContext } from "svelte";
    import { type OpenChat } from "openchat-client";

    export let action: (
        accepted: boolean,
        chatRulesVersion: number | undefined,
        communityRulesVersion: number | undefined
    ) => void;

    const client = getContext<OpenChat>("client");

    // Deliberately not reactive statements so that the rules don't change while the user is reading them
    let currentChatRules = client.currentChatRules;
    let currentCommunityRules = client.currentCommunityRules;
    let chatRulesEnabled = $currentChatRules?.enabled ?? false;
    let communityRulesEnabled = $currentCommunityRules?.enabled ?? false;

    function buildConfirmMessage(): string {
        const chatRulesText = chatRulesEnabled ? $currentChatRules?.text : "";
        const comunityRulesText = communityRulesEnabled ? $currentCommunityRules?.text : "";
        let lineBreak = chatRulesEnabled && communityRulesEnabled ? "\n\n" : "";
        return comunityRulesText + lineBreak + chatRulesText;
    }

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

        action(accepted, chatRulesVersion, communityRulesVersion);

        return Promise.resolve();
    }
</script>

<AreYouSure
    title={$_("rules.acceptTitle")}
    message={buildConfirmMessage()}
    yesLabel={$_("rules.accept")}
    noLabel={$_("rules.reject")}
    action={onAction} />
