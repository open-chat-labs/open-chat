<script lang="ts">
    import Input from "./Input.svelte";
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import { i18nKey } from "../i18n/i18n";

    const MIN_DISPLAY_NAME_LENGTH = 3;
    const MAX_DISPLAY_NAME_LENGTH = 25;

    interface Props {
        client: OpenChat;
        originalDisplayName: string | undefined;
        displayName: string | undefined;
        displayNameValid: boolean;
        disabled: boolean;
        children?: import("svelte").Snippet;
    }

    let {
        client,
        originalDisplayName,
        displayName = $bindable(),
        displayNameValid = $bindable(),
        disabled,
        children,
    }: Props = $props();

    let invalid = $derived(originalDisplayName !== displayName && !displayNameValid);

    onMount(() => {
        displayName = originalDisplayName;
        displayNameValid = true;
    });

    function onChange(val: string | number | bigint) {
        if (typeof val !== "string") return;

        displayName = val;

        if (displayName.length === 0) {
            displayName = undefined;
            displayNameValid = true;
            return;
        }

        displayNameValid = client.isDisplayNameValid(displayName);
    }
</script>

<Input
    {onChange}
    value={originalDisplayName ?? ""}
    {disabled}
    {invalid}
    minlength={MIN_DISPLAY_NAME_LENGTH}
    maxlength={MAX_DISPLAY_NAME_LENGTH}
    countdown
    placeholder={i18nKey("register.enterDisplayName")}>
    {@render children?.()}
</Input>
