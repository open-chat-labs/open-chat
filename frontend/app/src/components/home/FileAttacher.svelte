<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import Paperclip from "./Paperclip.svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let open: boolean = false;

    const dispatch = createEventDispatcher();

    let fileinput: HTMLInputElement;

    function click() {
        if (open) {
            dispatch("close");
        } else {
            dispatch("open");
            fileinput.click();
        }
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
                        toastStore.showFailureToast(err);
                    });

                e.currentTarget.value = "";
            }
        }
    }
</script>

<div on:click={click}>
    <HoverIcon title={open ? $_("close") : $_("attachFile")}>
        {#if open}
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        {:else}
            <Paperclip />
        {/if}
        <input bind:this={fileinput} hidden={true} type="file" on:change={onFileSelected} />
    </HoverIcon>
</div>
