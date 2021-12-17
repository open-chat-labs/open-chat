<script lang="ts">
    import Register from "./Register.svelte";
    import type { RegisterController } from "../../fsm/register.controller";

    export let controller: RegisterController;

    $: uiState = controller.state;
    $: username = controller.username;
    $: phoneNumber = controller.phoneNumber;
    $: error = controller.error;

    function resendCode() {
        controller.resendRegistrationCode();
    }

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        controller.registerUser(ev.detail.username);
    }

    function submitPhoneNumber(ev: CustomEvent<{ countryCode: number; number: string }>) {
        controller.requestRegistrationCode(ev.detail);
    }

    function changePhoneNumber() {
        controller.changePhoneNumber();
    }

    function submitCode(ev: CustomEvent<{ code: string }>) {
        controller.submitRegistrationCode(ev.detail.code);
    }

    function complete() {
        controller.complete();
    }
</script>

<Register
    error={$error}
    state={$uiState}
    username={$username}
    phoneNumber={$phoneNumber}
    on:submitPhoneNumber={submitPhoneNumber}
    on:changePhoneNumber={changePhoneNumber}
    on:submitUsername={submitUsername}
    on:resendCode={resendCode}
    on:complete={complete}
    on:submitCode={submitCode} />
