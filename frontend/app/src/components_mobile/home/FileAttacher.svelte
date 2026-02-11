<script lang="ts">
    import type { AttachmentContent, OpenChat } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        onFileSelected: (content: AttachmentContent) => void;
        children: Snippet<[() => void]>;
    }

    let { onFileSelected, children }: Props = $props();

    let fileinput: HTMLInputElement | undefined = $state();

    function click() {
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

{@render children(click)}
<input bind:this={fileinput} hidden type="file" onchange={fileSelected} />
