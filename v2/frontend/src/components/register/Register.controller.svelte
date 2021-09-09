<script lang="ts">
    import Register from "./Register.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { RegisterMachine } from "../../fsm/register.machine";
    import type { RegisterState } from "./Register.types";
    import { useState } from "react";

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
        if ($machine.matches("awaiting_phone_number")) {
            uiState = "awaitingPhoneNumber";
        } else if ($machine.matches("awaiting_registration_code")) {
            uiState = "awaitingCode";
        } else if ($machine.matches("awaiting_username")) {
            uiState = "awaitingUsername";
        } else if ($machine.matches("registering_user_succeeded")) {
            uiState = "awaitingCompletion";
        } else if (
            [
                "resending_code",
                "checking_registration_code",
                "checking_phone_number",
                "registering_user",
            ].some($machine.matches)
        ) {
            uiState = "verifying";
        } else if (
            [
                "awaiting_canister",
                { checking_user_readiness: "loading_users" },
                { checking_user_readiness: "creating_canister" },
            ].some($machine.matches)
        ) {
            uiState = "awaitingCanister";
        } else {
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
