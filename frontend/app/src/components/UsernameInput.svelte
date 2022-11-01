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

    let timer: number | undefined = undefined;
    let input: Input;

    export function reset() {
        input.setValue(originalUsername);
    }

    function checkUsername(value: string) {
        if (value.length < 3 || value.length > 25) {
            stopChecking();
            return;
        }

        const currTimer = timer;

        client
            .checkUsername(value)
            .then((resp) => {
                if (currTimer !== timer) return;
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
            })
            .finally(stopChecking);
    }

    function onChange(ev: CustomEvent<string>) {
        validUsername = undefined;
        error = undefined;
        if (ev.detail === originalUsername) {
            stopChecking();
        } else {
            startChecking(ev.detail);
        }
    }

    function startChecking(username: string) {
        checking = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => checkUsername(username), 350);
    }

    function stopChecking() {
        checking = false;
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
    }
</script>

<Input
    bind:this={input}
    on:change={onChange}
    invalid={false}
    value={originalUsername}
    autofocus={true}
    minlength={MIN_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    countdown={true}
    placeholder={$_("register.enterUsername")}>
    <slot />
</Input>
