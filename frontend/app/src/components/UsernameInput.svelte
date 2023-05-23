<script lang="ts">
    import Input from "./Input.svelte";
    import { _ } from "svelte-i18n";
    import { logger } from "../utils/logging";
    import type { OpenChat } from "openchat-client";

    const MIN_USERNAME_LENGTH = 5;
    const MAX_USERNAME_LENGTH = 25;

    export let client: OpenChat;
    export let originalUsername = "";
    export let validUsername: string | undefined = undefined;
    export let error: string | undefined = undefined;
    export let checking = false;
    export let disabled = false;

    let timer: number | undefined = undefined;
    let input: Input;
    let currentPromise: Promise<unknown> | undefined;

    export function reset() {
        input.setValue(originalUsername);
    }

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

                validUsername = undefined;

                if (value === originalUsername) return;

                switch (resp) {
                    case "success":
                        error = undefined;
                        validUsername = value;
                        break;
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
                logger.error("Unable to check username: ", err);
                checking = false;
            });

        currentPromise = promise;
    }

    function onChange(ev: CustomEvent<string>) {
        checking = true;
        validUsername = undefined;
        error = undefined;
        scheduleCheck(ev.detail);
    }

    function scheduleCheck(username: string) {
        clearTimeout(timer);
        timer = setTimeout(() => checkUsername(username), 350);
    }
</script>

<Input
    bind:this={input}
    on:change={onChange}
    invalid={false}
    value={originalUsername}
    {disabled}
    minlength={MIN_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    countdown={true}
    placeholder={$_("register.enterUsername")}>
    <slot />
</Input>
