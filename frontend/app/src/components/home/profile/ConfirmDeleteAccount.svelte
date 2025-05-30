<script lang="ts">
    import { AuthProvider, i18nKey, OpenChat } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import { interpolate } from "../../../i18n/i18n";
    import { _ } from "svelte-i18n";
    import Markdown from "../Markdown.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import ReAuthenticate from "./ReAuthenticate.svelte";
    import type { DelegationChain, ECDSAKeyIdentity } from "@dfinity/identity";

    const client = getContext<OpenChat>("client");

    interface Props {
        deleting: boolean;
        onClose: () => void;
    }

    let { deleting = $bindable(), onClose }: Props = $props();

    let authenticating = $state(false);

    function deleteAccount(detail: {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
        provider: AuthProvider;
    }) {
        deleting = true;
        authenticating = false;
        return client
            .deleteCurrentUser(detail.key.getKeyPair(), detail.delegation.toJSON())
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("danger.deleteAccountFailed"));
                } else {
                    onClose();
                }
            })
            .finally(() => (deleting = false));
    }
</script>

<Overlay>
    <ModalContent>
        {#snippet header()}
            <Translatable resourceKey={i18nKey("danger.deleteAccount")} />
        {/snippet}
        {#snippet body()}
            {#if authenticating}
                <ReAuthenticate onSuccess={deleteAccount} message={i18nKey("danger.reauth")} />
            {:else}
                <Markdown
                    inline={false}
                    text={interpolate($_, i18nKey("danger.deleteAccountConfirm"))} />
            {/if}
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                <Button small onClick={onClose} secondary>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                {#if !authenticating}
                    <Button
                        danger
                        disabled={deleting}
                        loading={deleting}
                        small
                        onClick={() => (authenticating = true)}>
                        <Translatable
                            resourceKey={i18nKey(
                                deleting ? "danger.deleting" : "danger.deleteAccount",
                            )} />
                    </Button>
                {/if}
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>
