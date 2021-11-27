<script lang="ts">
    import Home from "./Home.svelte";
    import { identityService } from "../../fsm/identity.machine";
    const { state, send } = identityService;

    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

    function logout() {
        send({ type: "LOGOUT" });
    }

    $: controller = $state.context.homeController;
</script>

{#if controller !== undefined}
    <Home {controller} {params} on:logout={logout} />
{/if}
