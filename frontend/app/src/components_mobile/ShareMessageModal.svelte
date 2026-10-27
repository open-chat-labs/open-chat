<script lang="ts">
    import type { ChatIdentifier, OpenChat } from "@client";
    import { localUpdates, sharedDraftText } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import type { Share } from "../utils/share";
    import { toastStore } from "../stores/toast";
    import SelectChatModal from "./SelectChatModal.svelte";

    interface Props {
        share: Share;
        /** Called when the user backs out of the picker without choosing a chat. */
        onClose: () => void;
        /**
         * Called when the user has picked a chat. The caller is responsible
         * for both closing the modal *and* navigating to the chat — keeping
         * those atomic from the caller's side avoids the popstate race that
         * arises if the modal calls onClose (history.back) and then tries
         * to navigate independently.
         */
        onShare: (chatId: ChatIdentifier) => void;
    }

    let { onClose, onShare, share }: Props = $props();

    const client = getContext<OpenChat>("client");

    function shareMessage(chatId: ChatIdentifier) {
        localUpdates.draftMessages.setTextContent({ chatId }, sharedDraftText(share));

        // The composer holds a single attachment per draft, so when the share
        // delivers multiple files we attach the first and drop the rest. Fire
        // the conversion off rather than awaiting it — the draft store is
        // reactive, so the composer picks up the attachment as soon as it
        // resolves, which keeps the modal-close path snappy for large files.
        const firstFile = share.files[0];
        if (firstFile) {
            client
                .messageContentFromFile(firstFile, { chatId })
                .then((content) => localUpdates.draftMessages.setAttachment({ chatId }, content))
                .catch((err) => toastStore.showFailureToast(i18nKey(err)));
        }

        onShare(chatId);
    }
</script>

<SelectChatModal {onClose} onSelect={shareMessage} />
