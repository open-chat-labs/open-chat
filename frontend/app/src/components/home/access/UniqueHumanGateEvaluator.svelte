<script lang="ts">
    import { iconSize, type Level } from "openchat-client";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import VerificationFlow from "../verification/VerificationFlow.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    interface Props {
        level: Level;
        expiry: bigint | undefined;
        // The gate is satisfied by the on-chain verification itself - no
        // credential is produced or submitted
        onVerified: () => void;
        onClose: () => void;
    }

    let { level, expiry, onVerified, onClose }: Props = $props();
</script>

<div class="header">
    <AccountCheck size={$iconSize} color={"var(--txt)"} />
    <div class="title">
        <Translatable resourceKey={i18nKey("access.uniquePerson", undefined, level, true)} />
    </div>
</div>
{#if expiry !== undefined}
    <p class="expiry">
        <AccessGateExpiry {expiry} />
    </p>
{/if}
<VerificationFlow onCancel={onClose} onSuccess={onVerified} />

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;
    }

    .expiry {
        margin-bottom: $sp4;
        @include font(book, normal, fs-90);
    }
</style>
