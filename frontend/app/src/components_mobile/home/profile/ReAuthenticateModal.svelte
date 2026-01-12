<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import Translatable from "@src/components/Translatable.svelte";
    import { Column, Sheet, Subtitle } from "component-lib";
    import type { AuthProvider, ResourceKey } from "openchat-client";
    import ReAuthenticate from "./ReAuthenticate.svelte";
    interface Props {
        message: ResourceKey;
        title: ResourceKey;
        onSuccess: (args: {
            key: ECDSAKeyIdentity;
            delegation: DelegationChain;
            provider: AuthProvider;
        }) => void;
        onCancel: () => void;
    }

    let { onSuccess, message, onCancel, title }: Props = $props();
</script>

<Sheet onDismiss={onCancel}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={title}></Translatable>
        </Subtitle>
        <ReAuthenticate autoSelect {onSuccess} {message} />
    </Column>
</Sheet>
