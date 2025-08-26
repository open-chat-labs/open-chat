<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import Overlay from "@src/components/Overlay.svelte";
    import Translatable from "@src/components/Translatable.svelte";
    import type { AuthProvider, ResourceKey } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
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

<Overlay dismissible onClose={onCancel}>
    <ModalContent hideFooter closeIcon onClose={onCancel}>
        {#snippet header()}
            <Translatable resourceKey={title}></Translatable>
        {/snippet}
        {#snippet body()}
            <ReAuthenticate autoSelect {onSuccess} {message} />
        {/snippet}
    </ModalContent>
</Overlay>
