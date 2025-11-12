<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { fileFromDataTransferItems } from "@src/utils/datatransfer";
    import type { AttachmentContent, ChatSummary, OpenChat } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import PlusCircle from "svelte-material-icons/PlusCircle.svelte";
    import { fade } from "svelte/transition";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        children: Snippet;
        mode: "thread" | "message";
        chat: ChatSummary;
        onFileSelected: (content: AttachmentContent) => void;
    }

    let { children, mode = "message", onFileSelected, chat }: Props = $props();
    let dragging: boolean = $state(false);

    function onDataTransfer(data: DataTransfer): void {
        const file = fileFromDataTransferItems([...data.items]);
        if (file) {
            client
                .messageContentFromFile(file)
                .then((content) => {
                    let permission = client.contentTypeToPermission(content.kind);
                    if (client.canSendMessage(chat.id, mode, permission)) {
                        onFileSelected(content);
                    } else {
                        const errorMessage = i18nKey("permissions.notPermitted", {
                            permission: $_(`permissions.threadPermissions.${permission}`),
                        });
                        toastStore.showFailureToast(errorMessage);
                    }
                })
                .catch((err) => toastStore.showFailureToast(i18nKey(err)));
        }
    }

    function drop(e: DragEvent) {
        dragging = false;
        if (e.dataTransfer) {
            onDataTransfer(e.dataTransfer);
            e.preventDefault();
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="drop-target"
    class:dragging
    ondragover={(e) => {
        e.preventDefault();
        dragging = true;
    }}
    ondragenter={() => (dragging = true)}
    ondragleave={() => (dragging = false)}
    ondrop={drop}>
    {@render children()}

    {#if dragging}
        <div transition:fade={{ duration: 200 }} class="overlay">
            <Translatable resourceKey={i18nKey("dropFile")}></Translatable>
            <PlusCircle size={"2em"} color={"white"} />
        </div>
    {/if}
</div>

<style lang="scss">
    .drop-target {
        position: relative;
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;

        .overlay {
            pointer-events: none;
            border: 4px dashed white;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backdrop-filter: var(--modal-filter);
            background-color: rgba(0, 0, 0, 0.4);
            display: flex;
            flex-direction: column;
            gap: $sp5;
            justify-content: center;
            align-items: center;
            @include font(bold, normal, fs-200);
            @include z-index("overlay");
            color: white;
        }
    }
</style>
