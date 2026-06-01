<script lang="ts">
    import type { ChatIdentifier } from "openchat-client";
    import { chatListScopeStore, localUpdates, routeForChatIdentifier } from "openchat-client";
    import page from "page";
    import type { Share } from "../utils/share";
    import SelectChatModal from "./SelectChatModal.svelte";

    interface Props {
        share: Share;
        onClose: () => void;
    }

    let { onClose, share }: Props = $props();

    $inspect("SHARE", share);

    function shareMessage(chatId: ChatIdentifier) {
        console.log("ROUTE TO CHAT", chatId);

        const shareText = share.text ?? "";
        const shareTitle = share.title ?? "";
        const shareUrl = share.url ?? "";

        let text = shareText.length > 0 ? shareText : shareTitle;

        if (shareUrl.length > 0) {
            if (text.length > 0) {
                text += "\n";
            }
            text += shareUrl;
        }

        localUpdates.draftMessages.setTextContent({ chatId }, text);

        // onClose() calls history.back() to consume the dummy history entry
        // the sliding modal pushed when it opened. Navigating before that
        // back() settles makes the back() rewind past our new route, so we
        // defer the page() until after popstate has fired.
        onClose();
        setTimeout(() => page(routeForChatIdentifier($chatListScopeStore.kind, chatId)));
    }
</script>

<SelectChatModal {onClose} onSelect={shareMessage} />
