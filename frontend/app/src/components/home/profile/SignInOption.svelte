<script lang="ts">
    import { AuthProvider, type ResourceKey } from "openchat-client";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import AuthProviderLogo from "./AuthProviderLogo.svelte";

    export let provider: AuthProvider;
    export let name: ResourceKey;
    export let hollow: boolean = false;
</script>

<div class="auth-option">
    <AuthProviderLogo {provider} />
    <Button fill {hollow} on:click>
        <Translatable resourceKey={name} />
    </Button>
</div>

<style lang="scss">
    :global(.auth-option button) {
        border-radius: 0 $sp2 $sp2 0;
    }

    .auth-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex: auto;
    }
</style>
