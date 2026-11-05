<script lang="ts">
    import type { MessageContext, OpenChat } from "@client";
    import { attachRefusal } from "@src/logic/composer/composer";
    import { getContext, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        accept?: string;
        messageContext: MessageContext;
        children: Snippet<[() => void]>;
    }

    let { accept, messageContext, children }: Props = $props();

    let fileinput: HTMLInputElement | undefined = $state();

    function click() {
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

{@render children(click)}
<input bind:this={fileinput} hidden type="file" {accept} onchange={fileSelected} />
