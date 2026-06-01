<script lang="ts">
    import type { ChatIdentifier, OpenChat } from "openchat-client";
    import { chatListScopeStore, localUpdates, routeForChatIdentifier } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import type { Share } from "../utils/share";
    import { toastStore } from "../stores/toast";
    import SelectChatModal from "./SelectChatModal.svelte";

    interface Props {
        share: Share;
        onClose: () => void;
    }

    let { onClose, share }: Props = $props();

    const client = getContext<OpenChat>("client");

    function shareMessage(chatId: ChatIdentifier) {
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

        // The composer holds a single attachment per draft, so when the share
        // delivers multiple files we attach the first and drop the rest. Fire
        // the conversion off rather than awaiting it — the draft store is
        // reactive, so the composer picks up the attachment as soon as it
        // resolves, which keeps the modal-close path snappy for large files.
        const firstFile = share.files[0];
        if (firstFile) {
            client
                .messageContentFromFile(firstFile)
                .then((content) => localUpdates.draftMessages.setAttachment({ chatId }, content))
                .catch((err) => toastStore.showFailureToast(i18nKey(String(err))));
        }

        // onClose() calls history.back() to consume the dummy history entry
        // the sliding modal pushed when it opened. Navigating before that
        // back() settles makes the back() rewind past our new route, so we
        // defer the page() until after popstate has fired.
        onClose();
        setTimeout(() => page(routeForChatIdentifier($chatListScopeStore.kind, chatId)));
    }
</script>

<SelectChatModal {onClose} onSelect={shareMessage} />
