<script lang="ts">
    import Input, { type InputProps } from "../Input.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    type Props = InputProps & { error: ResourceKey[] };

    let { error, value = $bindable(), ...props }: Props = $props();
    let showError = $state(false);
    let timer = $state<number | undefined>(undefined);
    let firstError = $derived(error[0]);

    function onfocus() {
        timer = window.setTimeout(() => (showError = true), 250);
    }

    function onblur() {
        if (timer) {
            window.clearTimeout(timer);
        }
        showError = false;
    }
</script>

<div class:error={firstError !== undefined && showError} class="validating-input">
    <Input {onfocus} {onblur} {...props} bind:value>
        {#if firstError !== undefined && showError}
            <div class="error-wrapper">
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
    }
</style>
