<script lang="ts">
    import { AuthProvider, type ResourceKey } from "openchat-client";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import AuthProviderLogo from "./AuthProviderLogo.svelte";

    interface Props {
        provider: AuthProvider;
        name: ResourceKey;
        hollow?: boolean;
        onClick?: (e: MouseEvent) => void;
    }

    let { provider, name, hollow = false, onClick }: Props = $props();
</script>

<div class="auth-option">
    <AuthProviderLogo {provider} />
    <Button fill {hollow} {onClick}>
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
