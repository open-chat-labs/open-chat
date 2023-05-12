<script lang="ts">
    import type { CandidateGroupChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    export let step: number;
    export let enabled: boolean;
    export let candidateGroup: CandidateGroupChat;
    export let editing: boolean;

    function selectStep(n: number) {
        if (enabled) {
            dispatch("step", n);
        }
    }
</script>

<div class="steps" class:enabled>
    <div on:click={() => selectStep(0)} class:selected={step === 0} class="step">
        {$_("group.details")}
    </div>
    <div on:click={() => selectStep(1)} class:selected={step === 1} class="step">
        {$_("group.visibility")}
    </div>
    <div on:click={() => selectStep(2)} class:selected={step === 2} class="step">
        {$_("group.groupRules")}
    </div>
    <div on:click={() => selectStep(3)} class:selected={step === 3} class="step">
        {$_("group.permissions.permissions")}
    </div>
    {#if !candidateGroup.isPublic && !editing}
        <div on:click={() => selectStep(4)} class:selected={step === 4} class="step">
            {$_("group.invite.invite")}
        </div>
    {/if}
</div>

<style type="text/scss">
    .steps {
        display: flex;
        align-items: center;
        @include font(book, normal, fs-80);
        font-weight: 700;
        color: var(--txt-light);
        margin-bottom: $sp5;
        gap: $sp5;
        border-bottom: 1px solid var(--bd);

        @include mobile() {
            @include font(book, normal, fs-70);
            gap: $sp4;
        }

        .step {
            padding-bottom: 12px;
            margin-bottom: -2px;
            border-bottom: 4px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 4px solid var(--primary);
            }
        }

        &.enabled {
            .step {
                cursor: pointer;
            }
        }
    }
</style>
