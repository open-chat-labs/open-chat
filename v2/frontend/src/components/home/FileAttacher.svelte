<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import Paperclip from "svelte-material-icons/Paperclip.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { toastStore } from "../../stores/toast";
    import { messageContentFromFile } from "../../utils/media";
    import { createEventDispatcher } from "svelte";

    export let open: boolean = false;

    const dispatch = createEventDispatcher();

    let fileinput: HTMLInputElement;

    function click() {
        if (open) {
            dispatch("close");
        } else {
            fileinput.click();
        }
    }

    function onFileSelected(e: { currentTarget: HTMLInputElement }) {
        if (e.currentTarget) {
            const target = e.currentTarget;
            if (target.files && target.files[0]) {
                messageContentFromFile(target.files[0])
                    .then((content) => dispatch("fileSelected", content))
                    .catch((err) => toastStore.showFailureToast(err));
            }
        }
    }
</script>

<div on:click={click}>
    <HoverIcon>
        {#if open}
            <Close size={"1.2em"} color={"#aaa"} />
        {:else}
            <Paperclip size={"1.2em"} color={"#aaa"} />
        {/if}
        <input bind:this={fileinput} hidden={true} type="file" on:change={onFileSelected} />
    </HoverIcon>
</div>
