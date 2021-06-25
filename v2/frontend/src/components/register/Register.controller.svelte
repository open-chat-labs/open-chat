<script lang="ts">
    import Register from "./Register.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { RegisterMachine } from "../../fsm/register.machine";
    import type { RegisterState } from "./Register.types";

    export let machine: ActorRefFrom<RegisterMachine>;

    let uiState: RegisterState = "awaitingPhoneNumber";

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        machine.send({ type: "REGISTER_USER", ...ev.detail });
    }

    function submitPhoneNumber(ev: CustomEvent<{ countryCode: number; number: number }>) {
        machine.send({ type: "REQUEST_REGISTRATION_CODE", ...ev.detail });
    }

    function submitCode(ev: CustomEvent<{ code: number }>) {
        machine.send({ type: "SUBMIT_REGISTRATION_CODE", ...ev.detail });
    }

    function complete() {
        machine.send({ type: "COMPLETE" });
    }

    $: {
        switch ($machine.value) {
            case "awaiting_phone_number":
                uiState = "awaitingPhoneNumber";
                break;
            case "awaiting_registration_code":
                uiState = "awaitingCode";
                break;
            case "registration_code_valid":
                uiState = "codeValid";
                break;
            case "registration_code_invalid":
                uiState = "codeInvalid";
                break;
            case "registering_user_succeeded":
                uiState = "userValid";
                break;
            case "registering_user_failed":
                uiState = "userInvalid";
                break;
            case "checking_registration_code":
            case "registering_user":
                uiState = "verifying";
                break;
            default:
                uiState = { error: $machine.context.error };
        }
    }

    $: {
        console.log($machine.value);
    }
</script>

<Register
    state={uiState}
    on:submitPhoneNumber={submitPhoneNumber}
    on:submitUsername={submitUsername}
    on:complete={complete}
    on:submitCode={submitCode} />
