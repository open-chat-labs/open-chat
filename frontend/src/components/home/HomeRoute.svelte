<script lang="ts">
    import Home from "./Home.svelte";
    import type { IdentityController } from "../../fsm/identity.controller";
    import { getContext } from "svelte";

    let controller: IdentityController = getContext("identityController");

    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

    function logout() {
        controller.logout();
    }
</script>

{#if controller.homeController !== undefined}
    <Home controller={controller.homeController} {params} on:logout={logout} />
{/if}
