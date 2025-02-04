// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { AccessGate } from "./AccessGate";
import type { AccessGateConfig } from "./AccessGateConfig";
import type { CommunityId } from "./CommunityId";

export type CommunityMatch = { id: CommunityId, score: number, name: string, description: string, avatar_id?: bigint | undefined, banner_id?: bigint | undefined, member_count: number, channel_count: number, gate?: AccessGate | undefined, gate_config?: AccessGateConfig | undefined, moderation_flags: number, primary_language: string, verified: boolean, };
