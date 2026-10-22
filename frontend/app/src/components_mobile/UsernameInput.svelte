<script lang="ts">
    import type { UsernameCheck } from "@src/logic/profile/usernameCheck.svelte";
    import { Input, Spinner } from "component-lib";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";

    const MIN_EXTANT_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 20;

    interface Props {
        // the name being typed and its check with the backend (app/src/logic/profile)
        check: UsernameCheck;
        disabled?: boolean;
        // why the name was turned down when it was saved, if it was
        errorMsg?: string;
        // the user typed
        onChange?: () => void;
    }

    let { check, disabled = false, errorMsg, onChange }: Props = $props();

    let error = $derived(errorMsg ?? check.error);

    function changed(value: string) {
        check.set(value);
        onChange?.();
    }
</script>

<Input
    bind:value={() => check.value, changed}
    {disabled}
    error={error !== undefined || (!check.valid && !check.checking)}
    minlength={MIN_EXTANT_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    placeholder={interpolate($_, i18nKey("register.enterUsername"))}>
    {#snippet icon(color)}
        {#if check.checking}
            <Spinner
                size={"1.4rem"}
                backgroundColour={"var(--text-on-disabled-surface)"}
                foregroundColour={color} />
        {/if}
    {/snippet}
    {#snippet subtext()}
        <Translatable
            resourceKey={i18nKey(error ?? "Username, alphanumeric characters & underscrores only")}
        ></Translatable>
    {/snippet}
</Input>
