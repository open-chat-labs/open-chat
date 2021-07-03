<script lang="ts">
    import MiddlePanel from "./MiddlePanel.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../../fsm/loggedin.machine";

    export let params: { chatId: string | null } = { chatId: null };
    export let machine: ActorRefFrom<LoggedInMachine>;
</script>

{#if $machine.context.user}
    <MiddlePanel
        hideLeft={params.chatId !== null}
        selectedChatId={$machine.context.selectedChatId} />
{/if}
