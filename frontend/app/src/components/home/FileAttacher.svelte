<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import Paperclip from "./Paperclip.svelte";
    import type { OpenChat } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    const dispatch = createEventDispatcher();

    let fileinput: HTMLInputElement;

    function click() {
        dispatch("open");
        fileinput.click();
    }

    function onFileSelected(e: { currentTarget: HTMLInputElement }) {
        if (e.currentTarget) {
            const target = e.currentTarget;
            if (target.files && target.files[0]) {
                client
                    .messageContentFromFile(target.files[0])
                    .then((content) => {
                        dispatch("fileSelected", content);
                    })
                    .catch((err) => {
                        toastStore.showFailureToast(i18nKey(err));
                    });

                e.currentTarget.value = "";
            }
        }
    }
</script>

<div on:click={click}>
    <HoverIcon title={$_("attachFile")}>
        <Paperclip />
    </HoverIcon>
    <input bind:this={fileinput} hidden type="file" on:change={onFileSelected} />
</div>
