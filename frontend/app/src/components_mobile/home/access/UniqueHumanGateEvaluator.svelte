<script lang="ts">
    import { ColourVars, Column, Row, Subtitle } from "component-lib";
    import { type Level } from "openchat-client";
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

<Column gap={"lg"}>
    <Row crossAxisAlignment={"center"} gap={"sm"}>
        <AccountCheck size={"1.5rem"} color={ColourVars.textPrimary} />
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("access.uniquePerson", undefined, level, true)} />
        </Subtitle>
    </Row>
    {#if expiry !== undefined}
        <AccessGateExpiry {expiry} />
    {/if}
    <VerificationFlow onCancel={onClose} onSuccess={onVerified} />
</Column>
