<script lang="ts">
    import Register from "./Register.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { RegisterMachine } from "../../fsm/register.machine";
    import type { RegisterState } from "./Register.types";

    export let machine: ActorRefFrom<RegisterMachine>;

    let uiState: RegisterState = "awaitingPhoneNumber";

    function resendCode() {
        machine.send({ type: "RESEND_REGISTRATION_CODE" });
    }

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        machine.send({ type: "REGISTER_USER", ...ev.detail });
    }

    function submitPhoneNumber(ev: CustomEvent<{ countryCode: number; number: string }>) {
        machine.send({ type: "REQUEST_REGISTRATION_CODE", phoneNumber: ev.detail });
    }

    function changePhoneNumber() {
        machine.send({ type: "CHANGE_PHONE_NUMBER" });
    }

    function submitCode(ev: CustomEvent<{ code: string }>) {
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
            case "awaiting_username":
                uiState = "awaitingUsername";
                break;
            case "registering_user_succeeded":
                uiState = "awaitingCompletion";
                break;
            case "resending_code":
            case "checking_registration_code":
            case "checking_phone_number":
            case "registering_user":
                uiState = "verifying";
                break;
            case "awaiting_canister":
                uiState = "awaitingCanister";
                break;
            default:
                uiState = { error: $machine.context.error?.message ?? "" };
        }
    }
</script>

<Register
    error={$machine.context.error?.message}
    state={uiState}
    username={$machine.context.username}
    phoneNumber={$machine.context.phoneNumber}
    on:submitPhoneNumber={submitPhoneNumber}
    on:changePhoneNumber={changePhoneNumber}
    on:submitUsername={submitUsername}
    on:resendCode={resendCode}
    on:complete={complete}
    on:submitCode={submitCode} />
