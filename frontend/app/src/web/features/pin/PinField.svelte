<!-- One masked field for a six-digit PIN: anything but digits is dropped as it's typed. -->
<script lang="ts">
    import { PIN_LENGTH } from "./pinPrompt";

    interface Props {
        label: string;
        onInput: (pin: string) => void;
    }

    let { label, onInput }: Props = $props();

    function typed(input: HTMLInputElement) {
        const pin = input.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
        input.value = pin;
        onInput(pin);
    }
</script>

<input
    class="digits"
    oninput={(e) => typed(e.currentTarget)}
    type="password"
    inputmode="numeric"
    autocomplete="one-time-code"
    maxlength={PIN_LENGTH}
    aria-label={label} />

<style>
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
