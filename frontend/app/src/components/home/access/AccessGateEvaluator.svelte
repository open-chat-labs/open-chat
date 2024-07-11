<script lang="ts">
    import {
        isCompositeGate,
        isCredentialGate,
        isLeafGate,
        isPaymentGate,
        isUniquePersonGate,
        shouldPreprocessGate,
        type AccessGate,
        type AccessGateWithLevel,
        type LeafGate,
        type Level,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import Checkbox from "../../Checkbox.svelte";
    import PaymentGateEvaluator from "./PaymentGateEvaluator.svelte";
    import CredentialGateEvaluator from "./CredentialGateEvaluator.svelte";
    import UniqueHumanGateEvaluator from "./UniqueHumanGateEvaluator.svelte";

    const dispatch = createEventDispatcher();

    export let gates: AccessGateWithLevel[];
    export let level: Level;

    let result: IteratorResult<AccessGate>;
    let iterator = preprocessGates(gates, needsPreprocessing);
    let currentGate: AccessGate | undefined;
    let credentials: string[] = [];
    let optionalGatesByIndex: Map<number, LeafGate> = new Map();

    onMount(nextGate);

    function needsPreprocessing(gate: AccessGate): boolean {
        if (isCompositeGate(gate) && gate.operator === "or") {
            return gate.gates.some((g) => shouldPreprocessGate(g));
        } else {
            return shouldPreprocessGate(gate);
        }
    }

    function nextGate() {
        result = iterator.next();
        if (!result.done) {
            currentGate = result.value;
            if (isCompositeGate(currentGate) && currentGate.operator === "or") {
                optionalGatesByIndex = new Map(currentGate.gates.map((g, i) => [i, g]));
            }
            if (isLeafGate(currentGate)) {
                const found = [...optionalGatesByIndex.values()].find((g) => g === currentGate);
                if (found) {
                    nextGate();
                }
            }
        } else {
            currentGate = undefined;
            dispatch("complete", credentials);
        }
    }

    function* preprocessGates(
        gates: AccessGate[],
        predicate: (gate: AccessGate) => boolean,
    ): Generator<AccessGate> {
        for (const gate of gates) {
            if (predicate(gate)) {
                yield gate;
            }
            if (isCompositeGate(gate)) {
                yield* preprocessGates(gate.gates, predicate);
            }
        }
    }

    function credentialReceived(ev: CustomEvent<string>) {
        credentials.push(ev.detail);
        nextGate();
    }

    function toggleIndex(i: number, gate: LeafGate) {
        if (optionalGatesByIndex.has(i)) {
            optionalGatesByIndex.delete(i);
        } else {
            optionalGatesByIndex.set(i, gate);
        }
        optionalGatesByIndex = optionalGatesByIndex;
    }
</script>

<ModalContent hideHeader closeIcon on:close>
    <div let:onClose class="body access-gate-evaluator" slot="body">
        {#if currentGate}
            {#if isCompositeGate(currentGate) && currentGate.operator === "or"}
                <p>
                    You need to meet at least one of the following conditions. Choose which ones you
                    prefer.
                </p>

                {#each currentGate.gates as subgate, i}
                    <Checkbox
                        checked={!optionalGatesByIndex.has(i)}
                        on:change={() => toggleIndex(i, subgate)}
                        label={i18nKey(subgate.kind)}
                        id={`subgate_${i}`}></Checkbox>
                {/each}
            {:else if isCredentialGate(currentGate)}
                <CredentialGateEvaluator
                    on:close={onClose}
                    on:credentialReceived={credentialReceived}
                    gate={currentGate}
                    {level} />
            {:else if isUniquePersonGate(currentGate)}
                <UniqueHumanGateEvaluator
                    on:close={onClose}
                    on:credentialReceived={credentialReceived}
                    {level} />
            {:else if isPaymentGate(currentGate)}
                <PaymentGateEvaluator
                    gate={currentGate}
                    {level}
                    on:next={nextGate}
                    on:close={onClose} />
            {/if}

            <pre>{JSON.stringify(currentGate, null, 4)}</pre>
        {/if}
    </div>

    <div let:onClose slot="footer">
        <ButtonGroup>
            {#if currentGate !== undefined}
                {#if isCompositeGate(currentGate)}
                    <Button on:click={nextGate}>Next</Button>
                {:else}
                    <Button on:click={nextGate}>Skip</Button>
                {/if}
            {:else}
                <Button on:click={onClose}>Join</Button>
            {/if}
        </ButtonGroup>
    </div>
</ModalContent>
