<script lang="ts">
    import Home from "./Home.controller.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../../fsm/loggedin.machine";
    import { identityService } from "../../fsm/identity.machine";
    const { state, send } = identityService;

    export let params: { chatId: string | null } = { chatId: null };

    function logout() {
        send({ type: "LOGOUT" });
    }

    $: machine = $state.children.loggedInMachine as ActorRefFrom<LoggedInMachine>;
</script>

{#if $machine}
    <Home {machine} {params} on:logout={logout} />
{/if}
