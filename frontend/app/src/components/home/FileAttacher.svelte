<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import { getContext } from "svelte";
    import Paperclip from "./Paperclip.svelte";
    import type { AttachmentContent, OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        onOpen: () => void;
        onFileSelected: (content: AttachmentContent) => void;
    }

    let { onOpen, onFileSelected }: Props = $props();

    let fileinput: HTMLInputElement | undefined = $state();

    function click() {
        onOpen();
        fileinput?.click();
    }

    function fileSelected(e: { currentTarget: HTMLInputElement }) {
        if (e.currentTarget) {
            const target = e.currentTarget;
            if (target.files && target.files[0]) {
                client
                    .messageContentFromFile(target.files[0])
                    .then((content) => {
                        onFileSelected(content);
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
