<script lang="ts">
    import { iconSize } from "@client";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import VerificationFlow from "./VerificationFlow.svelte";

    interface Props {
        onClose: () => void;
        onSuccess: () => void;
    }

    let { onClose, onSuccess }: Props = $props();
</script>

<ModalContent fadeDelay={0} fadeDuration={0} closeIcon hideFooter {onClose}>
    {#snippet header()}
        <div class="header">
            <AccountCheck size={$iconSize} color={"var(--txt)"} />
            <div class="title">
                <Translatable resourceKey={i18nKey("human.verification.title")} />
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <VerificationFlow onCancel={onClose} {onSuccess} />
    {/snippet}
</ModalContent>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        display: flex;
        align-items: center;
        gap: $sp3;
    }
</style>
