<script lang="ts">
    import Register from "./Register.svelte";
    import {
        requestNewCode,
        savePhoneNumber,
        saveUsername,
        sendConfirmationCode,
    } from "../../stores/appState";

    function resendCode() {
        requestNewCode();
    }

    function submitCode(ev: CustomEvent<{ code: string }>) {
        sendConfirmationCode(ev.detail.code);
    }

    function submitPhoneNumber(ev: CustomEvent<{ countryCode: number; number: string }>) {
        savePhoneNumber(ev.detail);
    }

    function submitUsername(ev: CustomEvent<{ username: string }>) {
        saveUsername(ev.detail.username);
    }

    function changePhoneNumber() {
        // machine.send({ type: "CHANGE_PHONE_NUMBER" });
        console.log("change phone number");
    }

    function complete() {
        // machine.send({ type: "COMPLETE" });
        console.log("complete");
    }
</script>

<Register
    on:submitPhoneNumber={submitPhoneNumber}
    on:changePhoneNumber={changePhoneNumber}
    on:submitUsername={submitUsername}
    on:resendCode={resendCode}
    on:complete={complete}
    on:submitCode={submitCode} />
