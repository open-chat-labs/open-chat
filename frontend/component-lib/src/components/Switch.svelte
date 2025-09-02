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
        transition: border-color 0.3s;
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
            transform 0.3s,
            background 0.3s,
            color 0.3s;
    }

    .toggle-knob::before {
        content: "−";
    }

    .toggle-input:checked + .toggle-track {
        border-color: var(--secondary);
    }

    .toggle-input:checked + .toggle-track .toggle-knob {
        transform: translateX(1.5rem);
        background: var(--secondary);
        color: var(--text-on-primary);
    }

    .toggle-input:checked + .toggle-track .toggle-knob::before {
        content: "✓";
        font-size: 14px;
    }
</style>
