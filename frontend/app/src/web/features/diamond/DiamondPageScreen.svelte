<!-- The /diamond page's Diamond membership (9a, under Learn's doc page: MarketingScreen): DiamondContent's
     Free vs Diamond, or a member's own membership, with nothing to close. Paying needs the app (the PIN
     prompt, the wallet), so Upgrade and Extend go to the host (`onStartUpgrade`: sign in first, then the
     app's Diamond dialog), as do neither in app store builds, which don't sell Diamond. -->
<script lang="ts">
    import { diamondStatusStore } from "@client";
    import DiamondContent from "@openchat/ui/src/features/components/DiamondContent.svelte";
    import { disableDiamondPaymentFeature } from "@src/utils/features";
    import { diamondMembershipProps } from "./diamond.adapter";

    let { onStartUpgrade }: { onStartUpgrade: () => void } = $props();

    // signed out it's "inactive": the comparison
    const membership = $derived(diamondMembershipProps($diamondStatusStore));
</script>

<div class="card">
    <DiamondContent
        tokens={[]}
        balance={0}
        prices={{}}
        {...membership}
        onStartUpgrade={disableDiamondPaymentFeature ? undefined : onStartUpgrade} />
</div>

<style lang="scss">
    /* as the dialog's card, in the page's column */
    .card {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 580px;
        overflow: hidden;
        border-radius: var(--radius-xl);
        background: var(--surface-1);
        box-shadow: inset 0 0 0 1px var(--line-2);
    }
</style>
