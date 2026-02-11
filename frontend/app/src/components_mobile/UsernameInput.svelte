<script lang="ts">
    import { Input, Spinner } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    const MIN_EXTANT_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 20;

    interface Props {
        client: OpenChat;
        originalUsername: string;
        username: string;
        usernameValid: boolean;
        disabled?: boolean;
        errorMsg?: string;
    }

    let {
        client,
        originalUsername,
        username = $bindable(),
        usernameValid = $bindable(),
        disabled = false,
        errorMsg = $bindable(),
    }: Props = $props();

    let timer: number | undefined = undefined;
    let currentPromise: Promise<unknown> | undefined;
    let checking = $state(false);

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
                    errorMsg = undefined;
                    return;
                } else {
                    usernameValid = false;
                }

                if (resp === "username_taken") {
                    errorMsg = "register.usernameTaken";
                }
            })
            .catch((err) => {
                errorMsg = "register.errorCheckingUsername";
                client.logError("Unable to check username: ", err);
                checking = false;
                usernameValid = false;
            });

        currentPromise = promise;
    }

    $effect(() => {
        if (typeof username !== "string") return;

        let u = username;

        untrack(() => {
            usernameValid = client.isUsernameValid(u);
            errorMsg = undefined;

            window.clearTimeout(timer);
            checking = false;

            if (usernameValid || u.toLowerCase() === originalUsername.toLowerCase()) {
                checking = true;
                timer = window.setTimeout(() => checkUsername(u), 350);
            }
        });
    });
</script>

<Input
    bind:value={username}
    {disabled}
    error={errorMsg !== undefined || !usernameValid}
    minlength={MIN_EXTANT_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    placeholder={interpolate($_, i18nKey("register.enterUsername"))}>
    {#snippet icon(color)}
        {#if checking}
            <Spinner
                size={"1.4rem"}
                backgroundColour={"var(--text-tertiary)"}
                foregroundColour={color} />
        {/if}
    {/snippet}
    {#snippet subtext()}
        <Translatable
            resourceKey={i18nKey(
                errorMsg ?? "Username, alphanumeric characters & underscrores only",
            )}></Translatable>
    {/snippet}
</Input>
