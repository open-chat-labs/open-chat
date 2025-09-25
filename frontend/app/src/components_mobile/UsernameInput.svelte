<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../i18n/i18n";
    import Input from "./Input.svelte";

    const MIN_EXTANT_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 20;

    interface Props {
        client: OpenChat;
        originalUsername: string;
        username: string;
        usernameValid: boolean;
        error?: string | undefined;
        checking?: boolean;
        disabled?: boolean;
        autofocus?: boolean;
        children?: import("svelte").Snippet;
    }

    let {
        client,
        originalUsername,
        username = $bindable(),
        usernameValid = $bindable(),
        error = $bindable(undefined),
        checking = $bindable(false),
        disabled = false,
        autofocus = false,
        children,
    }: Props = $props();

    error;

    let timer: number | undefined = undefined;
    let currentPromise: Promise<unknown> | undefined;

    let invalid = $derived(originalUsername !== username && !usernameValid && !checking);

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

    function onChange(val: string | number | bigint) {
        if (typeof val !== "string") return;

        username = val;
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
    {onChange}
    value={originalUsername}
    {disabled}
    {invalid}
    {autofocus}
    minlength={MIN_EXTANT_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    countdown
    placeholder={i18nKey("register.enterUsername")}>
    {@render children?.()}
</Input>
