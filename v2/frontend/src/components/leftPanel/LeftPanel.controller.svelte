<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../../fsm/loggedin.machine";
    // import type { RegisterState } from "./Register.types";

    export let machine: ActorRefFrom<LoggedInMachine>;

    // let uiState: RegisterState = "awaitingPhoneNumber";

    $: {
        console.log($machine.value);
    }

    // $: {
    //     switch ($machine.value) {
    //         case "awaiting_phone_number":
    //             uiState = "awaitingPhoneNumber";
    //             break;
    //         case "awaiting_registration_code":
    //             uiState = "awaitingCode";
    //             break;
    //         case "awaiting_username":
    //             uiState = "awaitingUsername";
    //             break;
    //         case "registering_user_succeeded":
    //             uiState = "awaitingCompletion";
    //             break;
    //         case "checking_registration_code":
    //         case "checking_phone_number":
    //         case "registering_user":
    //             uiState = "verifying";
    //             break;
    //         default:
    //             uiState = { error: $machine.context.error?.message ?? "" };
    //     }
    // }
</script>

{#if $machine.context.user}
    <LeftPanel on:logout user={$machine.context.user} />
{/if}
