import type { Version } from "./version";

export type Canister = {
    id: string;
    wasmVersion: Version;
};
