<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import { getContext } from "svelte";
    import Paperclip from "./Paperclip.svelte";
    import type { AttachmentContent, MessageContext, OpenChat } from "@client";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        onOpen: () => void;
        messageContext: MessageContext;
        onFileSelected: (content: AttachmentContent, context: MessageContext) => void;
    }

    let { onOpen, messageContext, onFileSelected }: Props = $props();

    let fileinput: HTMLInputElement | undefined = $state();

    function click() {
        onOpen();
        fileinput?.click();
    }

    function fileSelected(e: { currentTarget: HTMLInputElement }) {
        if (e.currentTarget) {
            const target = e.currentTarget;
            if (target.files && target.files[0]) {
                // Captured now: preparing a video can take a while and the chat may change under it
                const context = messageContext;
                client
                    .messageContentFromFile(target.files[0], context)
                    .then((content) => {
                        onFileSelected(content, context);
                    })
                    .catch((err) => {
                        toastStore.showFailureToast(i18nKey(err));
                    });

                e.currentTarget.value = "";
            }
        }
    }
</script>

<div onclick={click}>
    <HoverIcon title={$_("attachFile")}>
        <Paperclip />
    </HoverIcon>
    <input bind:this={fileinput} hidden type="file" onchange={fileSelected} />
</div>
