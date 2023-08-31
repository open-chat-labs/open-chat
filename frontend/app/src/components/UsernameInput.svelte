<script lang="ts">
    import Input from "./Input.svelte";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";

    const MIN_USERNAME_LENGTH = 5;
    const MAX_USERNAME_LENGTH = 15;

    export let client: OpenChat;
    export let originalUsername: string;
    export let username: string;
    export let usernameValid: boolean;
    export let error: string | undefined = undefined;
    export let checking = false;
    export let disabled = false;

    let timer: number | undefined = undefined;
    let input: Input;
    let currentPromise: Promise<unknown> | undefined;

    $: invalid = originalUsername !== username && !usernameValid;

    onMount(() => {
        username = originalUsername;
        usernameValid = originalUsername?.length > 0;
    });

    function checkUsername(value: string) {
        if (value.length < MIN_USERNAME_LENGTH || value.length > MAX_USERNAME_LENGTH) {
            checking = false;
            return;
        }

        const promise = client
            .checkUsername(value)
            .then((resp) => {
                if (promise !== currentPromise) {
                    return;
                }

                checking = false;

                if (value === originalUsername || resp === "success") {
                    usernameValid = true;
                    error = undefined;
                    return;
                }

                switch (resp) {
                    case "username_taken":
                        error = "register.usernameTaken";
                        break;
                    case "username_too_short":
                        error = "register.usernameTooShort";
                        break;
                    case "username_too_long":
                        error = "register.usernameTooLong";
                        break;
                    case "username_invalid":
                        error = "register.usernameInvalid";
                        break;
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
        checking = true;
        username = ev.detail;
        usernameValid = false;
        error = undefined;
        scheduleCheck(username);
    }

    function scheduleCheck(username: string) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => checkUsername(username), 350);
    }
</script>

<Input
    bind:this={input}
    on:change={onChange}
    value={originalUsername}
    {disabled}
    {invalid}
    minlength={MIN_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    countdown
    placeholder={$_("register.enterUsername")}>
    <slot />
</Input>
