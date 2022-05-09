<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { toastStore } from "../../stores/toast";
    import { messageContentFromFile } from "../../utils/media";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../stores/iconSize";
    import Paperclip from "./Paperclip.svelte";

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
                messageContentFromFile(target.files[0])
                    .then((content) => {
                        console.log("file attacher: message content created: ", content);
                        dispatch("fileSelected", content);
                    })
                    .catch((err) => {
                        console.log(
                            "file attacher: error getting message content from file: ",
                            err
                        );
                        toastStore.showFailureToast(err);
                    });

                e.currentTarget.value = "";
            } else {
                console.log("file attacher: target.files looks wrong: ", target.files);
            }
        } else {
            console.log("file attacher: target is not defined");
        }
    }
</script>

<div on:click={click}>
    <HoverIcon>
        {#if open}
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        {:else}
            <Paperclip />
        {/if}
        <input bind:this={fileinput} hidden={true} type="file" on:change={onFileSelected} />
    </HoverIcon>
</div>
