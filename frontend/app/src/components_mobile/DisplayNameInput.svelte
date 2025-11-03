<script lang="ts">
    import { Input } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    const MIN_DISPLAY_NAME_LENGTH = 3;
    const MAX_DISPLAY_NAME_LENGTH = 25;

    interface Props {
        client: OpenChat;
        originalDisplayName: string | undefined;
        displayName: string | undefined;
        displayNameValid: boolean;
        disabled?: boolean;
        errorMsg?: string;
    }

    let {
        client,
        originalDisplayName,
        displayName = $bindable(),
        displayNameValid = $bindable(),
        disabled = false,
        errorMsg = $bindable(),
    }: Props = $props();

    void displayNameValid;

    onMount(() => {
        displayName = originalDisplayName;
        displayNameValid = true;
    });

    $effect(() => {
        if (typeof displayName !== "string") return;

        let d = displayName;

        untrack(() => {
            if (d.length === 0) {
                displayName = undefined;
                displayNameValid = true;
                return;
            }

            displayNameValid = client.isDisplayNameValid(d);
        });
    });
</script>

<Input
    bind:value={displayName}
    {disabled}
    minlength={MIN_DISPLAY_NAME_LENGTH}
    maxlength={MAX_DISPLAY_NAME_LENGTH}
    countdown
    placeholder={interpolate($_, i18nKey("register.enterDisplayName"))}>
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey(errorMsg ?? "Optionally enter your display name")}
        ></Translatable>
    {/snippet}
</Input>
