<script lang="ts">
    import Input, { type InputProps } from "../Input.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";

    type Props = InputProps & { error: string | undefined };

    let { error, value = $bindable(), ...props }: Props = $props();
    let showError = $state(false);
</script>

<div class:error={error !== undefined && showError} class="validating-input">
    <Input
        onfocus={() => (showError = true)}
        onblur={() => (showError = false)}
        {...props}
        bind:value>
        {#if error && showError}
            <ErrorMessage>{error}</ErrorMessage>
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
        }
    }
</style>
