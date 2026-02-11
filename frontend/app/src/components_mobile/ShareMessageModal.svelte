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

    function shareMessage(chatId: ChatIdentifier) {
        page(routeForChatIdentifier($chatListScopeStore.kind, chatId));

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
        onClose();
    }
</script>

<SelectChatModal {onClose} onSelect={shareMessage} />
