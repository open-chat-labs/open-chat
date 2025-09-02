<script lang="ts">
    interface Props {
        checked: boolean;
    }

    let { checked = $bindable() }: Props = $props();
</script>

<label class="toggle">
    <input bind:checked type="checkbox" class="toggle-input" />
    <span class="toggle-track">
        <span class="toggle-knob"></span>
    </span>
</label>

<style lang="scss">
    .toggle {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
    }

    .toggle-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }

    .toggle-track {
        width: 3rem;
        height: 1.5rem;
        border-radius: var(--rad-circle);
        border: var(--bw-thick) solid var(--text-secondary);
        display: flex;
        align-items: center;
        padding: 1.5px;
        transition: border-color 0.2s;
        background: transparent;
    }

    .toggle-knob {
        width: 1.1rem;
        height: 1.1rem;
        border-radius: var(--rad-circle);
        background: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-on-primary);
        font-size: 1rem;
        font-weight: bold;
        transition:
            transform 0.2s,
            background 0.2s,
            color 0.2s;
        position: relative;
    }

    .toggle-knob::before {
        content: "";
        width: 10px;
        height: 1px;
        background: var(--text-on-primary);
        display: block;
        transition: opacity 0.2s;
    }

    .toggle-knob::after {
        content: "";
        position: absolute;
        width: 12px;
        height: 14px;
        background: var(--text-on-primary);
        mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='black' d='M7.6 13.2l-3.2-3.2-1.4 1.4 4.6 4.6 9.6-9.6-1.4-1.4z'/></svg>")
            no-repeat center / contain;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .toggle-input:checked + .toggle-track {
        border-color: #1da1f2;
    }

    .toggle-input:checked + .toggle-track .toggle-knob {
        transform: translateX(1.5rem);
        background: var(--secondary);
        color: var(--text-on-primary);
    }

    .toggle-input:checked + .toggle-track .toggle-knob::before {
        opacity: 0;
    }

    .toggle-input:checked + .toggle-track .toggle-knob::after {
        opacity: 1;
    }
</style>
