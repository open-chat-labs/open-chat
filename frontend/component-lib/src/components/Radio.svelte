<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        group?: string;
        value?: string;
        checked?: boolean;
        id: string;
        disabled?: boolean;
        compact?: boolean;
        children?: Snippet;
        onChange?: () => void;
    }

    let {
        group = "radio-group",
        value = "radio-value",
        checked = false,
        id,
        disabled = false,
        compact = false,
        children,
        onChange,
    }: Props = $props();
</script>

<label class="radio">
    <input
        type="radio"
        name={group}
        class="radio-input"
        {value}
        {checked}
        {disabled}
        {id}
        onchange={onChange} />
    <span class="radio-control"></span>
    <span class="radio-label">
        {@render children?.()}
    </span>
</label>

<style lang="scss">
    .radio {
        display: flex;
        align-items: center;
        gap: var(--sp-md);
    }

    .radio-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .radio-control {
        width: 1.5rem;
        height: 1.5rem;
        border-radius: var(--rad-circle);
        border: var(--bw-thick) solid var(--disabled-button);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition:
            border-color 0.2s,
            background 0.2s;
    }

    .radio-control::before {
        content: "";
        width: 1rem;
        height: 1rem;
        display: block;
        mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='black' d='M7.6 13.2l-3.2-3.2-1.4 1.4 4.6 4.6 9.6-9.6-1.4-1.4z'/></svg>")
            no-repeat center / contain;
        background: var(--text-on-primary);
        opacity: 0;
        transition: opacity 0.2s;
    }

    .radio-input:checked + .radio-control {
        background: var(--secondary);
        border-color: var(--secondary);
    }

    .radio-input:checked + .radio-control::before {
        opacity: 1;
    }

    .radio-label {
        color: var(--text-primary);
    }
</style>
