// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { AccessGate } from "./AccessGate";
import type { AccessGateConfig } from "./AccessGateConfig";
import type { GroupSubtype } from "./GroupSubtype";

export type ChannelMatch = { id: bigint, name: string, description: string, avatar_id?: bigint, member_count: number, gate?: AccessGate, gate_config?: AccessGateConfig, subtype?: GroupSubtype, };
