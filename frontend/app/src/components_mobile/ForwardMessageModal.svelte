<script lang="ts">
    import { messageToForwardStore } from "@src/stores/messageToForward";
    import type { ChatIdentifier, Message } from "openchat-client";
    import { chatListScopeStore, routeForChatIdentifier } from "openchat-client";
    import page from "page";
    import SelectChatModal from "./SelectChatModal.svelte";

    interface Props {
        msg: Message;
        onClose: () => void;
    }

    let { onClose, msg }: Props = $props();

    function forwardMessage(chatId: ChatIdentifier) {
        page(routeForChatIdentifier($chatListScopeStore.kind, chatId));
        messageToForwardStore.set(msg);
        onClose();
    }
</script>

<SelectChatModal {onClose} onSelect={forwardMessage} />
