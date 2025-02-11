<script lang="ts">
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import { AuthProvider } from "openchat-client";
    import InternetIdentityLogo from "../../landingpages/InternetIdentityLogo.svelte";

    export let provider: AuthProvider;
    export let square: boolean = false;
</script>

<div class="icon center" class:square>
    {#if provider === AuthProvider.II}
        <InternetIdentityLogo />
    {:else if provider === AuthProvider.EMAIL}
        <EmailIcon size={"1.5em"} color={"var(--txt-light)"} />
    {:else if provider === AuthProvider.PASSKEY}
        <img class="passkey-img" src="/assets/passkey-icon.png" alt="passkey" />
    {:else if provider === AuthProvider.ETH}
        <img class="eth-img" src="/assets/ethereum.svg" alt="ethereum" />
    {:else if provider === AuthProvider.SOL}
        <img class="sol-img" src="/assets/solana.svg" alt="solana" />
    {:else if provider === AuthProvider.NFID}
        <img class="nfid-img" src="/assets/nfid.svg" alt="nfid" />
    {/if}
</div>

<style lang="scss">
    $height: 45px;

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
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

        &.square {
            border-radius: $sp2;
            border: none;
        }

        .nfid-img {
            width: 40px;
        }

        .passkey-img,
        .eth-img,
        .sol-img {
            width: 30px;
        }
    }
</style>
