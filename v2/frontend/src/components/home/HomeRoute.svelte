<script lang="ts">
    import Home from "./Home.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";
    import { identityService } from "../../fsm/identity.machine";
    const { state, send } = identityService;

    export let params: { chatId: string | null; eventIndex: string | undefined | null } = {
        chatId: null,
        eventIndex: undefined,
    };

    function logout() {
        send({ type: "LOGOUT" });
    }

    $: machine = $state.children.homeMachine as ActorRefFrom<HomeMachine>;
</script>

{#if $machine}
    <Home {machine} {params} on:logout={logout} />
{/if}
