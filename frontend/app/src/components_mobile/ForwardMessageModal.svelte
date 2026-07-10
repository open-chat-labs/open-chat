<script lang="ts">
    import { messageToForwardStore } from "@src/stores/messageToForward";
    import type { ChatIdentifier, Message } from "@client";
    import { chatListScopeStore, routeForChatIdentifier } from "@client";
    import { navigate } from "@utils/navigation";
    import SelectChatModal from "./SelectChatModal.svelte";

    interface Props {
        msg: Message;
        onClose: () => void;
    }

    let { onClose, msg }: Props = $props();

    function forwardMessage(chatId: ChatIdentifier) {
        navigate(routeForChatIdentifier($chatListScopeStore.kind, chatId));
        messageToForwardStore.set(msg);
        onClose();
    }
</script>

<SelectChatModal {onClose} onSelect={forwardMessage} />
