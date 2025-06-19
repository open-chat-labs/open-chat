<script lang="ts">
    import { configKeys } from "@src/utils/config";
    import { EmailSigninHandler } from "@src/utils/signin";
    import {
        AuthProvider,
        OpenChat,
        querystringStore,
        selectedAuthProviderStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import ChooseSignInOption from "../home/profile/ChooseSignInOption.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        error: string | undefined;
    }

    let { error = $bindable() }: Props = $props();

    let emailInvalid = $state(false);
    let email = $state(localStorage.getItem(configKeys.selectedAuthEmail) ?? "");
    let verificationCode: string | undefined = $state(undefined);
    let emailSigninHandler = new EmailSigninHandler(client, "registration", true);
    let restrictTo = $derived(new Set($querystringStore.getAll("auth")));

    function login(provider: AuthProvider) {
        if (emailInvalid && provider === AuthProvider.EMAIL) {
            return;
        }

        client.gaTrack("initiated_signin", "registration", provider);

        localStorage.setItem(configKeys.selectedAuthEmail, email);
        selectedAuthProviderStore.set(provider);

        if (provider === AuthProvider.EMAIL) {
            verificationCode = undefined;
            emailSigninHandler.generateMagicLink(email).then((resp) => {
                if (resp.kind === "success") {
                    verificationCode = resp.code;
                } else if (resp.kind === "email_invalid") {
                    error = "loginDialog.invalidEmail";
                } else if (resp.kind === "failed_to_send_email") {
                    console.debug("generateMagicLink failed_to_send_email", resp.error);
                    error = "loginDialog.failedToSendEmail";
                } else {
                    error = "loginDialog.unexpectedError";
                }
            });
        } else if (provider === AuthProvider.PASSKEY) {
            client.signInWithWebAuthn();
        } else if (provider === AuthProvider.ETH) {
            console.log("Logging in with ETH");
        } else if (provider === AuthProvider.SOL) {
            console.log("Logging in with SOL");
        } else {
            client.login();
        }
    }
</script>

<ChooseSignInOption onLogin={login} mode={"signin"} {restrictTo} bind:emailInvalid bind:email />

<style lang="scss"></style>
