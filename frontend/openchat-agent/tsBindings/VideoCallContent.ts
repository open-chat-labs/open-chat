// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CallParticipant } from "./CallParticipant";
import type { VideoCallType } from "./VideoCallType";

export type VideoCallContent = { call_type: VideoCallType, ended?: bigint, participants: Array<CallParticipant>, hidden_participants: number, };
