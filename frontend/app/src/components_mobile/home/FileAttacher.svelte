<script lang="ts">
    import type { AttachmentContent, MessageContext, OpenChat } from "@client";
    import { getContext, type Snippet } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        accept?: string;
        messageContext: MessageContext;
        onFileSelected: (content: AttachmentContent, context: MessageContext) => void;
        children: Snippet<[() => void]>;
    }

    let { accept, messageContext, onFileSelected, children }: Props = $props();

    let fileinput: HTMLInputElement | undefined = $state();

    function click() {
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

{@render children(click)}
<input bind:this={fileinput} hidden type="file" {accept} onchange={fileSelected} />
