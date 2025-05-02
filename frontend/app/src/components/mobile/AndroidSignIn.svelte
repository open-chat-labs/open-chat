<script module lang="ts">
    export type Props = {
        mode: "signin" | "signup";
    };
</script>

<script lang="ts">
    import { getContext } from "svelte";
    import { AuthProvider, type OpenChat } from "openchat-client";
    import ChooseSignInOption from "../home/profile/ChooseSignInOption.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    let { mode }: Props = $props();

    function login() {
        switch (mode) {
            case "signin": {
                client.signInWithAndroidWebAuthn().catch((e) => {
                    console.error("ERROR", e);
                    toastStore.showFailureToast(i18nKey(`mobile.credentials.errors.genericSignIn`));
                });
                break;
            }
            case "signup":
                client.signUpWithAndroidWebAuthn(true).catch((e) => {
                    console.error("ERROR", e);
                    toastStore.showFailureToast(i18nKey(`mobile.credentials.errors.genericSignUp`));
                });
        }
    }
</script>

<div>
    <ChooseSignInOption
        onLogin={login}
        {mode}
        restrictTo={new Set([AuthProvider.PASSKEY])}
        emailInvalid={false}
        email="" />
</div>

<style lang="scss">
</style>
