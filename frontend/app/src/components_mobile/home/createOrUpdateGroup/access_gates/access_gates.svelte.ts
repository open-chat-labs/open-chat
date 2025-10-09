import {
    isCompositeGate,
    type AccessGateConfig,
    type LeafGate,
    type NeuronGate,
} from "openchat-client";

export function addLeaf(gateConfig: AccessGateConfig, newGate: LeafGate) {
    if (isCompositeGate(gateConfig.gate)) {
        gateConfig.gate.gates.push(newGate);
    } else {
        if (gateConfig.gate.kind === "no_gate") {
            gateConfig.gate = newGate;
        } else {
            const oldGate = { ...gateConfig.gate };
            gateConfig.gate = {
                kind: "composite_gate",
                gates: [oldGate, newGate],
                operator: "and",
            };
        }
    }
}

export function deleteGate(gateConfig: AccessGateConfig, gate: LeafGate) {
    if (isCompositeGate(gateConfig.gate)) {
        gateConfig.gate.gates = gateConfig.gate.gates.filter((g) => !gatesMatch(g, gate));
        if (gateConfig.gate.gates.length === 1) {
            gateConfig.gate = gateConfig.gate.gates[0];
        }
    } else {
        gateConfig.gate = { kind: "no_gate" };
    }
}

function gatesMatch(a: LeafGate, b: LeafGate): boolean {
    // TODO fill in other types
    if (a.kind === "neuron_gate" && b.kind === "neuron_gate") {
        return a.governanceCanister === b.governanceCanister;
    }
    return a.kind === b.kind;
}

export function defaultNeuronGate(): NeuronGate {
    return {
        kind: "neuron_gate",
        governanceCanister: "",
    };
}
