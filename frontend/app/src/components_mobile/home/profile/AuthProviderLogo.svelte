<script lang="ts">
    import { AuthProvider } from "openchat-client";
    import EmailIcon from "svelte-material-icons/EmailOutline.svelte";
    import InternetIdentityLogo from "../../landingpages/InternetIdentityLogo.svelte";
    import OnBoardOptionLogo from "./OnBoardOptionLogo.svelte";

    interface Props {
        provider: AuthProvider;
        square?: boolean;
    }

    let { provider, square = false }: Props = $props();
</script>

<OnBoardOptionLogo {square}>
    {#if provider === AuthProvider.II}
        <InternetIdentityLogo />
    {:else if provider === AuthProvider.EMAIL}
        <EmailIcon size={"1.5em"} color={"var(--txt-light)"} />
    {:else if provider === AuthProvider.PASSKEY}
        <img class="passkey-img" src="/assets/passkey.svg" alt="passkey" />
    {:else if provider === AuthProvider.ETH}
        <img class="eth-img" src="/assets/ethereum.svg" alt="ethereum" />
    {:else if provider === AuthProvider.SOL}
        <img class="sol-img" src="/assets/solana.svg" alt="solana" />
    {:else if provider === AuthProvider.NFID}
        <img class="nfid-img" src="/assets/nfid.svg" alt="nfid" />
    {/if}
</OnBoardOptionLogo>

<style lang="scss">
    .nfid-img {
        width: 40px;
    }

    .passkey-img,
    .eth-img,
    .sol-img {
        width: 30px;
    }
</style>
