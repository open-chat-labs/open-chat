<script lang="ts">
    import Register from "./Register.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { RegisterMachine } from "../../fsm/register.machine";

    export let machine: ActorRefFrom<RegisterMachine>;

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        machine.send({ type: "REGISTER_USER", ...ev.detail });
    }

    function submitPhoneNumber(
        ev: CustomEvent<{ countryCode: number; number: number }>
    ) {
        machine.send({ type: "REQUEST_REGISTRATION_CODE", ...ev.detail });
    }

    function submitCode(ev: CustomEvent<{ code: number }>) {
        machine.send({ type: "SUBMIT_REGISTRATION_CODE", ...ev.detail });
    }

    $: verifying =
        $machine.matches("checking_registration_code") ||
        $machine.matches("registering_user");

    $: {
        console.log($machine.value);
    }
</script>

<Register
    awaitingPhoneNumber={$machine.matches("awaiting_phone_number")}
    awaitingCode={$machine.matches("awaiting_registration_code")}
    codeValid={$machine.matches("registration_code_valid")}
    {verifying}
    on:submitPhoneNumber={submitPhoneNumber}
    on:submitUsername={submitUsername}
    on:submitCode={submitCode} />
