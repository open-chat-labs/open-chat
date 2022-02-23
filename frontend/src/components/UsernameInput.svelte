<script lang="ts">
    import Input from "./Input.svelte";
    import { _ } from "svelte-i18n";
    import type { ServiceContainer } from "../services/serviceContainer";
    import { rollbar } from "../utils/logging";

    const MIN_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 25;

    export let api: ServiceContainer;
    export let originalUsername = "";
    export let validUsername: string | undefined = undefined;
    export let error: string | undefined = undefined;
    export let checking = false;

    let timer: number | undefined = undefined;
    let input: Input;

    export function reset() {
        input.setValue(originalUsername);
    }

    function debounce(fn: () => void) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, 350);
    }

    function checkUsername(value: string) {
        if (value.length < 3 || value.length > 25) {
            checking = false;
            return;
        }
        
        api.checkUsername(value)
            .then((resp) => {
                if (!checking) return;
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
                rollbar.error("Unable to check username: ", err);
            })
            .finally(() => checking = false);
    }

    function onChange(ev: CustomEvent<string>) {
        validUsername = undefined;
        if (ev.detail === originalUsername) {
            checking = false;
            error = undefined;
            if (timer) clearTimeout(timer);
        } else {
            checking = true;
            debounce(() => ( checkUsername(ev.detail) ));
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