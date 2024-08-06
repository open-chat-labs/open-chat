<script lang="ts">
    import { AuthProvider, type ResourceKey } from "openchat-client";
    import Button from "../../Button.svelte";
    import InternetIdentityLogo from "../../landingpages/InternetIdentityLogo.svelte";
    import Translatable from "../../Translatable.svelte";

    export let provider: AuthProvider;
    export let name: ResourceKey;
    export let hollow: boolean = false;
</script>

<div class="auth-option">
    <div class="icon center">
        {#if provider === AuthProvider.II}
            <InternetIdentityLogo />
        {:else if provider === AuthProvider.ETH}
            <img class="eth-img" src="/assets/ethereum.svg" alt="ethereum" />
        {:else if provider === AuthProvider.SOL}
            <img class="sol-img" src="/assets/solana.svg" alt="solana" />
        {:else if provider === AuthProvider.NFID}
            <img class="nfid-img" src="/assets/nfid.svg" alt="nfid" />
        {/if}
    </div>
    <Button fill {hollow} on:click>
        <Translatable resourceKey={name} />
    </Button>
</div>

<style lang="scss">
    $height: 45px;

    :global(.auth-option button) {
        border-radius: 0 $sp2 $sp2 0;
    }

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .auth-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex: auto;
    }

    .icon {
        flex: 0 0 60px;
        width: 60px;
        height: $height;
        border-radius: $sp2 0 0 $sp2;
        border-right: 1px solid var(--bd);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--input-bg);

        .nfid-img {
            width: 40px;
        }

        .eth-img,
        .sol-img {
            width: 30px;
        }
    }
</style>
