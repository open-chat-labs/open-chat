<script lang="ts">
    import type { UsernameCheck } from "@src/logic/profile/usernameCheck.svelte";
    import { i18nKey } from "../i18n/i18n";
    import Input from "./Input.svelte";

    const MIN_EXTANT_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 20;

    interface Props {
        // the name being typed and its check with the backend (app/src/logic/profile)
        check: UsernameCheck;
        disabled?: boolean;
        autofocus?: boolean;
        // the user typed
        onChange?: () => void;
        children?: import("svelte").Snippet;
    }

    let { check, disabled = false, autofocus = false, onChange, children }: Props = $props();

    let invalid = $derived(check.status !== "unchanged" && !check.valid && !check.checking);

    function changed(val: string | number | bigint) {
        if (typeof val !== "string") return;
        check.set(val);
        onChange?.();
    }
</script>

<Input
    onChange={changed}
    value={check.value}
    {disabled}
    {invalid}
    {autofocus}
    minlength={MIN_EXTANT_USERNAME_LENGTH}
    maxlength={MAX_USERNAME_LENGTH}
    countdown
    placeholder={i18nKey("register.enterUsername")}>
    {@render children?.()}
</Input>
