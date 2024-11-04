<script lang="ts">
    import Input from "./Input.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import { isDiamond } from "openchat-client";
    import Button from "./Button.svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";

    const MIN_DISPLAY_NAME_LENGTH = 3;
    const MAX_DISPLAY_NAME_LENGTH = 25;
    const dispatch = createEventDispatcher();

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

{#if $isDiamond || originalDisplayName !== undefined}
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
{:else}
    <div class="upgrade">
        <Button fill on:click={() => dispatch("upgrade")}
            ><Translatable resourceKey={i18nKey("upgrade.forDisplayName")} /></Button>
    </div>
{/if}

<style lang="scss">
    .upgrade {
        margin-bottom: $sp3;
    }
</style>
