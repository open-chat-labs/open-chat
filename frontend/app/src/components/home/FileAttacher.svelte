<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";
    import { getContext } from "svelte";
    import Paperclip from "./Paperclip.svelte";
    import type { MessageContext, OpenChat } from "@client";
    import { attachRefusal } from "@src/logic/composer/composer";

    const client = getContext<OpenChat>("client");

    interface Props {
        onOpen: () => void;
        messageContext: MessageContext;
    }

    let { onOpen, messageContext }: Props = $props();

    let fileinput: HTMLInputElement | undefined = $state();

    function click() {
        onOpen();
        fileinput?.click();
    }

    async function fileSelected(e: { currentTarget: HTMLInputElement }) {
        const target = e.currentTarget;
        const file = target.files?.[0];
        if (file === undefined) return;
        target.value = "";
        // the chat it was picked in, whichever is open once the file is ready
        const outcome = await client.attachFile(file, messageContext);
        if (outcome.kind !== "attached") {
            toastStore.showFailureToast(attachRefusal(outcome, $_));
        }
    }
</script>

<div onclick={click}>
    <HoverIcon title={$_("attachFile")}>
        <Paperclip />
    </HoverIcon>
    <input bind:this={fileinput} hidden type="file" onchange={fileSelected} />
</div>
