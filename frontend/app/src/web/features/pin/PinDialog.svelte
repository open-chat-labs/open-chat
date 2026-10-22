<!-- Asks for the user's PIN while the client waits to make a transfer, as the old UIs'
     PinNumberModal: six digits answer straight away, closing gives the transfer up. A wrong PIN isn't
     shown here: the screen that started the transfer shows it (pinNumberErrorMessageStore). -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { _ } from "svelte-i18n";
    import PinField from "./PinField.svelte";
    import { PIN_LENGTH } from "./pinPrompt";

    interface Props {
        onEnter: (pin: string) => void;
        onClose: () => void;
        onForgot: () => void;
    }

    let { onEnter, onClose, onForgot }: Props = $props();
</script>

<!-- TODO(design): no standalone PIN dialog in the design (GAPS.md); WalletSend's has the look -->
<DialogShell title={$_("pinNumber.enterPin")} width={360} height="auto" {onClose}>
    <div class="pin">
        <PinField
            label={$_("pinNumber.enterPin")}
            onInput={(pin) => {
                if (pin.length === PIN_LENGTH) onEnter(pin);
            }} />
        <Button label={$_("pinNumber.forgotLabel")} variant="ghost" onClick={onForgot} />
    </div>
</DialogShell>

<style>
    .pin {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-16);
    }
</style>
