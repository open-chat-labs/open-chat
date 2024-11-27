<script lang="ts">
    import Input from "./Input.svelte";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import { i18nKey } from "../i18n/i18n";

    const MIN_DISPLAY_NAME_LENGTH = 3;
    const MAX_DISPLAY_NAME_LENGTH = 25;

    export let client: OpenChat;
    export let originalDisplayName: string | undefined;
    export let displayName: string | undefined;
    export let displayNameValid: boolean;
    export let disabled: boolean;

    $: invalid = originalDisplayName !== displayName && !displayNameValid;

    onMount(() => {
        displayName = originalDisplayName;
        displayNameValid = true;
    });

    function onChange(ev: CustomEvent<string>) {
        displayName = ev.detail;

        if (displayName.length === 0) {
            displayName = undefined;
            displayNameValid = true;
            return;
        }

        displayNameValid = client.isDisplayNameValid(displayName);
    }
</script>

<Input
    on:change={onChange}
    value={originalDisplayName ?? ""}
    {disabled}
    {invalid}
    minlength={MIN_DISPLAY_NAME_LENGTH}
    maxlength={MAX_DISPLAY_NAME_LENGTH}
    countdown
    placeholder={i18nKey("register.enterDisplayName")}>
    <slot />
</Input>
