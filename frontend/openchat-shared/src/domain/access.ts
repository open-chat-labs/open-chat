export type AccessGate =
    | NoGate
    | Sns1NeuronGate
    | OpenChatNeuronGate
    | DiamondGate
    | NnsNeuronGate
    | NftGate;

export type NoGate = { kind: "no_gate" };

export type NnsNeuronGate = { kind: "nns_gate" };

export type NftGate = { kind: "nft_gate" };

type SnsNeuronGate = {
    minStakeE8s?: number;
    minDissolveDelay?: number;
};

export type Sns1NeuronGate = SnsNeuronGate & {
    kind: "sns1_gate";
};

export type OpenChatNeuronGate = SnsNeuronGate & {
    kind: "openchat_gate";
};

export type DiamondGate = { kind: "diamond_gate" };

export type AccessControlled = {
    gate: AccessGate;
    public: boolean;
    frozen: boolean;
    historyVisible: boolean;
};
