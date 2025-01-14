<script lang="ts">
    import Input from "../Input.svelte";
    import { type InputProps } from "../Input.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    type Props = InputProps & { error: ResourceKey[] };

    let { onblur, onfocus, disabled, error, value = $bindable(), ...props }: Props = $props();
    let showError = $state(disabled);
    let timer = $state<number | undefined>(undefined);
    let firstError = $derived(error[0]);

    function onFocusInternal() {
        timer = window.setTimeout(() => (showError = true), 250);
        onfocus?.();
    }

    function onBlurInternal() {
        if (timer) {
            window.clearTimeout(timer);
        }
        showError = disabled;
        onblur?.();
    }
</script>

<div class:error={firstError !== undefined && showError} class="validating-input">
    <Input onfocus={onFocusInternal} onblur={onBlurInternal} {disabled} {...props} bind:value>
        {#if firstError !== undefined && showError}
            <div class="error-wrapper" class:disabled>
                <ErrorMessage>
                    <Translatable resourceKey={firstError}></Translatable>
                </ErrorMessage>
            </div>
        {/if}
    </Input>
</div>

<style lang="scss">
    .validating-input.error {
        :global(.input-wrapper input) {
            border-radius: var(--rd) var(--rd) 0 0;
        }
    }
    .validating-input.error {
        :global(.input-wrapper .error) {
            border-radius: 0 0 var(--rd) var(--rd);
            margin-bottom: 0;
        }
    }

    .error-wrapper {
        position: absolute;
        width: 100%;
        margin: auto;
        @include z-index("error");

        &.disabled {
            position: relative;
        }
    }
</style>
