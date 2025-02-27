// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { AccessGate } from "./AccessGate";
import type { AccessGateConfig } from "./AccessGateConfig";
import type { BuildVersion } from "./BuildVersion";
import type { ChatId } from "./ChatId";
import type { ChatMetrics } from "./ChatMetrics";
import type { EventIndex } from "./EventIndex";
import type { EventWrapperMessage } from "./EventWrapperMessage";
import type { FrozenGroupInfo } from "./FrozenGroupInfo";
import type { GroupCanisterThreadDetails } from "./GroupCanisterThreadDetails";
import type { GroupMembership } from "./GroupMembership";
import type { GroupPermissions } from "./GroupPermissions";
import type { GroupRole } from "./GroupRole";
import type { GroupSubtype } from "./GroupSubtype";
import type { HydratedMention } from "./HydratedMention";
import type { MessageIndex } from "./MessageIndex";
import type { TSPrincipal } from "./TSPrincipal";
import type { VideoCall } from "./VideoCall";

export type GroupCanisterGroupChatSummary = { chat_id: ChatId, local_user_index_canister_id: TSPrincipal, last_updated: bigint, name: string, description: string, subtype?: GroupSubtype, avatar_id?: bigint, is_public: boolean, history_visible_to_new_joiners: boolean, messages_visible_to_non_members: boolean, min_visible_event_index: EventIndex, min_visible_message_index: MessageIndex, latest_message?: EventWrapperMessage, latest_event_index: EventIndex, latest_message_index?: MessageIndex, joined: bigint, participant_count: number, role: GroupRole, mentions: Array<HydratedMention>, wasm_version: BuildVersion, permissions_v2: GroupPermissions, notifications_muted: boolean, metrics: ChatMetrics, my_metrics: ChatMetrics, latest_threads: Array<GroupCanisterThreadDetails>, frozen?: FrozenGroupInfo, date_last_pinned?: bigint, events_ttl?: bigint, events_ttl_last_updated: bigint, gate?: AccessGate, gate_config?: AccessGateConfig, rules_accepted: boolean, membership?: GroupMembership, video_call_in_progress?: VideoCall, verified: boolean, };
