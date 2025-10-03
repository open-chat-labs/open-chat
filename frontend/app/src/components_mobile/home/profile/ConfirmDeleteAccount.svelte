<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { CommonButton, Container } from "component-lib";
    import { AuthProvider, i18nKey, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import { interpolate } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
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
            <Container gap={"md"} mainAxisAlignment={"end"} crossAxisAlignment={"end"}>
                <CommonButton mode={"default"} onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")}></Translatable>
                </CommonButton>
                {#if !authenticating}
                    <CommonButton
                        mode={"active"}
                        disabled={deleting}
                        loading={deleting}
                        onClick={() => (authenticating = true)}
                        size={"medium"}>
                        {#snippet icon(color)}
                            <Delete {color}></Delete>
                        {/snippet}
                        <Translatable
                            resourceKey={i18nKey(
                                deleting ? "danger.deleting" : "danger.deleteAccount",
                            )} />
                    </CommonButton>
                {/if}
            </Container>
        {/snippet}
    </ModalContent>
</Overlay>
