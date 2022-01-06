<script lang="ts">
    import Register from "./Register.svelte";
    import type { RegisterController } from "../../fsm/register.controller";
    import type { PhoneNumber } from "../../domain/user/user";
    import type { IdentityController } from "../../fsm/identity.controller";

    export let controller: RegisterController;
    export let identityController: IdentityController;

    $: uiState = controller.state;
    $: username = controller.username;
    $: error = controller.error;

    function resendCode(ev: CustomEvent<{ phoneNumber: PhoneNumber }>) {
        controller.resendRegistrationCode(ev.detail.phoneNumber);
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

    function submitCode(ev: CustomEvent<{ code: string; phoneNumber: PhoneNumber }>) {
        controller.submitRegistrationCode(ev.detail.phoneNumber, ev.detail.code);
    }

    function complete() {
        controller.complete();
    }

    function choosePhoneVerification() {
        controller.choosePhoneVerification();
    }

    function chooseTransfer() {
        // We are hard-coding the choice of currency for now, but the code will exist to support cycles payments fairly easily
        controller.chooseTransfer("icp");
    }

    function reset() {
        controller.reset();
    }

    function cyclesTransferConfirmed() {
        controller.cyclesTransferConfirmed();
    }

    function icpTransferConfirmed() {
        controller.icpTransferConfirmed();
    }
</script>

<Register
    error={$error}
    state={$uiState}
    username={$username}
    on:reset={reset}
    on:cyclesTransferConfirmed={cyclesTransferConfirmed}
    on:icpTransferConfirmed={icpTransferConfirmed}
    on:choosePhoneVerification={choosePhoneVerification}
    on:chooseTransfer={chooseTransfer}
    on:submitPhoneNumber={submitPhoneNumber}
    on:changePhoneNumber={changePhoneNumber}
    on:submitUsername={submitUsername}
    on:resendCode={resendCode}
    on:complete={complete}
    on:logout={() => identityController.logout()}
    on:submitCode={submitCode} />
