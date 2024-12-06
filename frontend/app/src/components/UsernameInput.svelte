<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import Input from "./Input.svelte";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";

    const MIN_EXTANT_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 15;

    export let client: OpenChat;
    export let originalUsername: string;
    export let username: string;
    export let usernameValid: boolean;
    export let error: string | undefined = undefined;
    export let checking = false;
    export let disabled = false;
    export let autofocus = false;

    let timer: number | undefined = undefined;
    let currentPromise: Promise<unknown> | undefined;

    $: invalid = originalUsername !== username && !usernameValid && !checking;

    onMount(() => {
        username = originalUsername;
        usernameValid = originalUsername?.length > 0;
    });

    function checkUsername(value: string) {
        const promise = client
            .checkUsername(value, false)
            .then((resp) => {
                if (promise !== currentPromise) {
                    return;
                }

                checking = false;

                if (value.toLowerCase() === originalUsername.toLowerCase() || resp === "success") {
                    usernameValid = true;
                    error = undefined;
                    return;
                }

                if (resp === "username_taken") {
                    error = "register.usernameTaken";
                }
            })
            .catch((err) => {
                error = "register.errorCheckingUsername";
                client.logError("Unable to check username: ", err);
                checking = false;
            });

        currentPromise = promise;
    }

    function onChange(ev: CustomEvent<string>) {
        username = ev.detail;
        usernameValid = false;
        error = undefined;

        window.clearTimeout(timer);
        checking = false;

        if (
            client.isUsernameValid(username) ||
            username.toLowerCase() === originalUsername.toLowerCase()
        ) {
            checking = true;
            timer = window.setTimeout(() => checkUsername(username), 350);
        }
    }
</script>

<Input
    on:change={onChange}
    value={originalUsername}
    {disabled}
    {invalid}
    {autofocus}
    minlength={MIN_EXTANT_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    countdown
    placeholder={i18nKey("register.enterUsername")}>
    <slot />
</Input>
