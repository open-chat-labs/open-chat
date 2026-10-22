<!-- Asks for the user's PIN while the client waits to make a transfer, as the old UIs'
     PinNumberModal: six digits answer straight away, closing gives the transfer up. A wrong PIN isn't
     shown here: the screen that started the transfer shows it (pinNumberErrorMessageStore). -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { _ } from "svelte-i18n";
    import { PIN_LENGTH } from "./pinPrompt";

    interface Props {
        onEnter: (pin: string) => void;
        onClose: () => void;
        /** Without it there's no "I've forgotten my pin". */
        onForgot?: () => void;
    }

    let { onEnter, onClose, onForgot }: Props = $props();

    let pin = $state("");

    function typed(input: HTMLInputElement) {
        pin = input.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
        input.value = pin;
        if (pin.length === PIN_LENGTH) onEnter(pin);
    }
</script>

<!-- TODO(design): no standalone PIN dialog in the design (GAPS.md); WalletSend's has the look -->
<DialogShell title={$_("pinNumber.enterPin")} width={360} height="auto" {onClose}>
    <div class="pin">
        <input
            class="digits"
            value={pin}
            oninput={(e) => typed(e.currentTarget)}
            type="password"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength={PIN_LENGTH}
            aria-label={$_("pinNumber.enterPin")} />
        {#if onForgot !== undefined}
            <Button label={$_("pinNumber.forgotLabel")} variant="ghost" onClick={onForgot} />
        {/if}
    </div>
</DialogShell>

<style>
    .pin {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-16);
    }

    .digits {
        inline-size: 100%;
        box-sizing: border-box;
        padding: var(--space-12) var(--space-16);
        border: 1px solid var(--border-hairline);
        border-radius: var(--radius-md);
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-semibold) var(--text-xl) / 1.2 var(--font-mono);
        letter-spacing: var(--tracking-wide);
        text-align: center;
    }

    .digits:focus {
        outline: none;
        border-color: var(--accent);
    }
</style>
