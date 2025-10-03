<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { AuthProvider, i18nKey, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import ReAuthenticate from "./ReAuthenticate.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        deleting: boolean;
        onClose: () => void;
        authenticating?: boolean;
    }

    let { deleting = $bindable(), onClose, authenticating = $bindable(false) }: Props = $props();

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
