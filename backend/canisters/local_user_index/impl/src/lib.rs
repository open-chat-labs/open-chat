use crate::model::community_event_batch::CommunityEventBatch;
use crate::model::daily_puzzle_engine::{DailyPuzzleEngine, DailyPuzzleEngineMetrics};
use crate::model::daily_puzzle_result_batch::DailyPuzzleResultBatch;
use crate::model::game_chit_credit::{GameChitCreditRetryQueue, new_retry_queue};
use crate::model::group_event_batch::GroupEventBatch;
use crate::model::local_community_map::LocalCommunityMap;
use crate::model::local_group_map::LocalGroupMap;
use crate::model::local_multi_user_canister_map::LocalMultiUserCanisterMap;
use crate::model::media_scan_job_log::MediaScanJobLog;
use crate::model::moderation_queue::ModerationQueue;
use crate::model::premium_items::PremiumItems;
use crate::model::recent_joins::RecentJoins;
use crate::model::referral_codes::{ReferralCodes, ReferralTypeMetrics};
use crate::model::registry_tokens::RegistryTokens;
use crate::model::top_up_leaderboards::TopUpLeaderboards;
use crate::model::user_event_batch::UserEventBatch;
use crate::model::user_index_event_batch::UserIndexEventBatch;
use crate::model::users_to_migrate::{UserToCloseOut, UserToImport, UsersToMigrate};
use crate::model::web_push_subscriptions::WebPushSubscriptions;
use candid::Principal;
use canister_state_macros::canister_state;
use community_canister::LocalIndexEvent as CommunityEvent;
use constants::{MINUTE_IN_MS, MULTI_USER_CANISTER_MIN_CYCLES_BALANCE};
use ct_codecs::{Base64UrlSafeNoPadding, Encoder};
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use event_store_utils::EventDeduper;
use fire_and_forget_handler::FireAndForgetHandler;
use group_canister::LocalIndexEvent as GroupEvent;
use jwt::{Claims, sign_and_encode_token, sign_bytes, verify_and_decode};
use local_user_index_canister::{ChildCanisterType, GlobalUser};
use model::bots_map::BotsMap;
use model::global_user_map::GlobalUserMap;
use model::local_user_map::LocalUserMap;
use oc_error_codes::OCErrorCode;
use p256_key_pair::P256KeyPair;
use proof_of_unique_personhood::verify_proof_of_unique_personhood;
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use stable_memory_map::UserIdsKeyPrefix;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::time::Duration;
use timer_job_queues::{BatchedTimerJobQueue, GroupedTimerJobQueue};
use tracing::{error, info};
use types::{
    BotDataEncoding, BotEventPayload, BotEventWrapper, BotNotification, BotNotificationEnvelope, BuildVersion,
    CLAIM_TYPE_DECLINE_VIDEO_CALL, CLAIM_TYPE_DIAMOND_MEMBERSHIP, CallDismissalKind, CanisterId, ChannelLatestMessageIndex,
    Chat, ChatId, ChildCanisterWasms, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary, CommunityId, Cycles,
    CyclesTopUp, DailyPuzzleResult, DeclineVideoCallClaims, DiamondMembershipDetails, DirectCallDismissedNotification, FcmData,
    GroupCallDismissedNotification, IdempotentEnvelope, MediaScanConfig, MessageContentInitial, MessageId, Milliseconds,
    ModerationReferralConfig, Notification, NotificationEnvelope, OCResult, ReferralType, TimestampMillis, Timestamped, UserId,
    UserNotificationEnvelope, UserNotificationPayload, VerifiedCredentialGateArgs,
};
use user_canister::LocalUserIndexEvent as UserEvent;
use user_ids_set::UserIdsSet;
use user_index_canister::LocalUserIndexEvent as UserIndexEvent;
use utils::canister;
use utils::canister::{
    CanistersRequiringUpgrade, ChunkedWasmToInstall, FailedUpgradeCount, VersionedWasmToInstall, WasmToInstall,
};
use utils::env::Environment;
use utils::event_stream::EventStream;
use utils::fcm_token_store::FcmTokenStore;
use utils::idempotency_checker::IdempotencyChecker;
use utils::iterator_extensions::IteratorExtensions;
use utils::migrated_user_ids::MigratedUserIds;

mod bots;
mod call_push;
mod call_relay;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod no_inline_anchor;
mod queries;
mod updates;

const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes
const MULTI_USER_UPGRADE_CONCURRENCY: usize = 1;

// The cycles above its freezing threshold each type of child canister keeps. A child is created with
// this plus one top up, and is topped up by half this at a time.
fn child_min_cycles_balance(canister_type: ChildCanisterType) -> Cycles {
    match canister_type {
        ChildCanisterType::User => utils::cycles::USER_CANISTER_MIN_CYCLES_BALANCE, // 0.3T
        ChildCanisterType::Group | ChildCanisterType::Community => utils::cycles::MIN_CYCLES_BALANCE, // 1T
        ChildCanisterType::MultiUser => MULTI_USER_CANISTER_MIN_CYCLES_BALANCE,     // 10T
    }
}

fn child_top_up_amount(canister_type: ChildCanisterType) -> Cycles {
    child_min_cycles_balance(canister_type) / 2
}

fn child_initial_cycles_balance(canister_type: ChildCanisterType) -> Cycles {
    child_min_cycles_balance(canister_type) + child_top_up_amount(canister_type)
}

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn calling_user_id(&self) -> UserId {
        let caller = self.env.caller();
        self.data.global_users.get(&caller).unwrap().user_id
    }

    pub fn calling_user(&self) -> GlobalUser {
        let caller = self.env.caller();
        self.data.global_users.get(&caller).unwrap()
    }

    pub fn get_calling_user_and_process_credentials(
        &mut self,
        credential_args: Option<&VerifiedCredentialGateArgs>,
    ) -> GlobalUser {
        let mut user_details = self.calling_user();

        if let Some(credential_args) = credential_args {
            let now = self.env.now();
            let user_id = user_details.user_id;

            for jwt in credential_args.credential_jwts.iter() {
                if let Ok(unique_person_proof) = verify_proof_of_unique_personhood(
                    credential_args.user_ii_principal,
                    self.data.internet_identity_canister_id,
                    self.data.website_canister_id,
                    jwt,
                    &self.env.ic_root_key(),
                    now,
                ) {
                    self.push_event_to_user_index(
                        UserIndexEvent::NotifyUniquePersonProof(Box::new((user_id, unique_person_proof.clone()))),
                        now,
                    );
                    if self.data.local_users.contains(&user_id) {
                        self.push_event_to_user(
                            user_id,
                            UserEvent::NotifyUniquePersonProof(Box::new(unique_person_proof.clone())),
                            now,
                        );
                    }
                    user_details.unique_person_proof = Some(unique_person_proof.clone());
                    self.data
                        .global_users
                        .insert_unique_person_proof(user_id, unique_person_proof);
                } else if let Ok(claims) = verify_and_decode::<DiamondMembershipDetails>(
                    jwt,
                    self.data.oc_key_pair.public_key_pem(),
                    CLAIM_TYPE_DIAMOND_MEMBERSHIP,
                ) {
                    let expires_at = claims.custom().expires_at;
                    user_details.diamond_membership_expires_at = Some(expires_at);
                    self.data.global_users.set_diamond_membership_expiry_date(user_id, expires_at);
                }
            }
        }

        user_details
    }

    pub fn is_caller_user_index(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_index_canister_id == caller
    }

    pub fn is_caller_group_index(&self) -> bool {
        let caller = self.env.caller();
        self.data.group_index_canister_id == caller
    }

    pub fn is_caller_notifications_index(&self) -> bool {
        let caller = self.env.caller();
        self.data.notifications_index_canister_id == caller
    }

    pub fn is_caller_local_user_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_users.contains(&caller.into())
    }

    pub fn is_caller_local_multi_user_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_multi_user_canisters.contains(&caller)
    }

    pub fn is_caller_local_group_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_groups.contains(&caller.into())
    }

    pub fn is_caller_local_community_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_communities.contains(&caller.into())
    }

    pub fn is_caller_local_child_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_users.contains(&caller.into())
            || self.data.local_groups.contains(&caller.into())
            || self.data.local_communities.contains(&caller.into())
            || self.data.local_multi_user_canisters.contains(&caller)
    }

    pub fn child_canister_type(&self, canister_id: CanisterId) -> Option<ChildCanisterType> {
        if self.data.local_multi_user_canisters.contains(&canister_id) {
            Some(ChildCanisterType::MultiUser)
        } else if self.data.local_users.contains(&canister_id.into()) {
            Some(ChildCanisterType::User)
        } else if self.data.local_groups.contains(&canister_id.into()) {
            Some(ChildCanisterType::Group)
        } else if self.data.local_communities.contains(&canister_id.into()) {
            Some(ChildCanisterType::Community)
        } else {
            None
        }
    }

    // The cycles top ups of one of this canister's children, or None if it isn't one
    pub fn child_canister_cycle_top_ups(&self, canister_id: CanisterId) -> Option<&[CyclesTopUp]> {
        self.data
            .local_users
            .get(&canister_id.into())
            .map(|u| &u.cycle_top_ups)
            .or_else(|| self.data.local_groups.get(&canister_id.into()).map(|g| &g.cycle_top_ups))
            .or_else(|| self.data.local_communities.get(&canister_id.into()).map(|c| &c.cycle_top_ups))
            .or_else(|| {
                self.data
                    .local_multi_user_canisters
                    .get(&canister_id)
                    .map(|c| &c.cycle_top_ups)
            })
            .map(|t| t.as_slice())
    }

    pub fn is_caller_notification_pusher(&self) -> bool {
        let caller = self.env.caller();
        self.data.notification_pushers.contains(&caller)
    }

    pub fn is_caller_media_scanner(&self) -> bool {
        let caller = self.env.caller();
        self.data.media_scan_config.scanners.contains(&caller)
    }

    pub fn is_caller_openchat_user(&self) -> bool {
        let caller = self.env.caller();
        self.data.global_users.get(&caller).is_some()
    }

    pub fn is_caller_platform_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data
            .global_users
            .get_by_principal(&caller)
            .is_some_and(|u| u.is_platform_operator)
    }

    pub fn is_caller_daily_puzzle_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.daily_puzzle_canister_id == Some(caller)
    }

    pub fn is_caller_video_call_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data.video_call_operators.contains(&caller)
    }

    pub fn set_daily_puzzle_canister_id(&mut self, canister_id: CanisterId) {
        self.data.daily_puzzle_canister_id = Some(canister_id);
        match self.data.daily_puzzle_results_queue.as_mut() {
            Some(queue) => queue.set_state(canister_id),
            None => self.data.daily_puzzle_results_queue = Some(BatchedTimerJobQueue::new(canister_id, true)),
        }
        info!(canister_id = %canister_id, "Daily puzzle canister id set");
        jobs::pull_daily_puzzle::pull_now();
    }

    pub fn push_daily_puzzle_result(&mut self, result: DailyPuzzleResult) {
        if let Some(queue) = self.data.daily_puzzle_results_queue.as_mut() {
            queue.push(result);
        } else {
            error!(number = result.number, user_id = %result.user_id, "Daily puzzle canister id not set, result dropped");
        }
    }

    // A child canister's wasm to install. Its chunks are only recorded while they are in this
    // canister's chunk store, so it is installed from the chunks if there are any, else in full
    pub fn child_canister_wasm_to_install(&self, canister_type: ChildCanisterType) -> VersionedWasmToInstall {
        let wasm = self.data.child_canister_wasms.get(canister_type);
        VersionedWasmToInstall {
            version: wasm.wasm.version,
            wasm: if wasm.chunks.is_empty() {
                WasmToInstall::Default(wasm.wasm.module.clone())
            } else {
                WasmToInstall::Chunked(ChunkedWasmToInstall {
                    chunks: wasm.chunks.clone(),
                    wasm_hash: wasm.wasm_hash,
                    store_canister_id: self.env.canister_id(),
                })
            },
        }
    }

    pub fn push_event_to_user_index(&mut self, event: UserIndexEvent, now: TimestampMillis) {
        self.data.user_index_event_sync_queue.push(IdempotentEnvelope {
            created_at: now,
            idempotency_id: self.env.rng().next_u64(),
            value: event,
        });
    }

    // Whether this LocalUserIndex holds the user by their latest id, which, if they've been migrated to
    // a MultiUser canister held by another LocalUserIndex, it doesn't, even while it still holds
    // their old canister
    pub fn holds_latest_id_of(&self, user_id: UserId) -> bool {
        self.data.local_users.contains(&self.data.migrated_user_ids.latest(user_id))
    }

    // A direct chat may name the user by an id they had before being migrated to a MultiUser canister,
    // eg. a bot installed in their direct chats before then, which still knows them by it. Their old
    // canister is uninstalled once they've been migrated, so the chat is named by their latest id.
    // If another LocalUserIndex holds them by it, their new canister is on another subnet, where it
    // can't be reached from here, so the caller is told they've moved, and their new id.
    pub fn latest_chat(&self, chat: Chat) -> OCResult<Chat> {
        if let Chat::Direct(chat_id) = chat {
            let user_id = UserId::from(chat_id);
            let latest_user_id = self.data.migrated_user_ids.latest(user_id);
            if latest_user_id != user_id {
                return if self.data.local_users.contains(&latest_user_id) {
                    Ok(Chat::Direct(latest_user_id.into()))
                } else {
                    Err(OCErrorCode::UserMovedToNewSubnet.with_message(latest_user_id))
                };
            }
        }
        Ok(chat)
    }

    // Queues an event for the user, by their latest id if they've been migrated to a MultiUser canister.
    // Returns false if this LocalUserIndex doesn't hold them by that id. So an event naming a migrated
    // user by an old id, sent to every LocalUserIndex, is queued only by the one now holding them.
    pub fn push_event_to_user(&mut self, user_id: UserId, event: UserEvent, now: TimestampMillis) -> bool {
        let user_id = self.data.migrated_user_ids.latest(user_id);
        if self.data.local_users.contains(&user_id) {
            self.data.user_events_queue.push(
                user_id.canister_id(),
                IdempotentEnvelope {
                    created_at: now,
                    idempotency_id: self.env.rng().next_u64(),
                    value: (user_id, event),
                },
            );
            true
        } else {
            false
        }
    }

    // Tells the user of another user's new id
    pub fn notify_user_of_migrated_user_id(
        &mut self,
        user_id: UserId,
        old_user_id: UserId,
        new_user_id: UserId,
        now: TimestampMillis,
    ) {
        let latest_user_id = self.data.migrated_user_ids.latest(user_id);
        let event = UserEvent::UserIdMigrated(Box::new(user_canister::UserIdMigrated {
            old_user_id,
            new_user_id,
        }));

        if self.data.local_users.contains(&latest_user_id) {
            self.push_event_to_user(latest_user_id, event, now);
        } else {
            // The user isn't held here. If they've been migrated to a canister on another
            // LocalUserIndex, the notice is sent on to them there
            let envelope = IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: (latest_user_id, event),
            };
            self.push_events_queued_for_migrated_user(user_id, vec![envelope]);
        }
    }

    // Moves the events queued for a migrated user's old canister onto their latest id. If a batch of
    // them is being sent, they are left to be moved after it, once it fails (see `UserEventBatch`), so
    // that they stay in order.
    pub fn move_events_queued_for_migrated_user(&mut self, old_user_id: UserId) {
        let canister_id = old_user_id.canister_id();
        if old_user_id.index() == 0 && !self.data.user_events_queue.is_in_progress(&canister_id) {
            let events = self.data.user_events_queue.take(&canister_id);
            self.push_events_queued_for_migrated_user(old_user_id, events);
        }
    }

    // Moves what the daily puzzle engine holds for a migrated user under their old id, their streak
    // among it, onto their latest id. If this LocalUserIndex doesn't hold them by that id, it goes via
    // the UserIndex to the one which does, which is the one they play through from then on.
    pub fn move_daily_puzzle_data_for_migrated_user(&mut self, old_user_id: UserId) {
        let new_user_id = self.data.migrated_user_ids.latest(old_user_id);
        if new_user_id == old_user_id {
            return;
        }
        let Some(data) = self.data.daily_puzzle_engine.take_user(old_user_id) else {
            return;
        };
        if self.data.local_users.contains(&new_user_id) {
            self.data.daily_puzzle_engine.import_user(new_user_id, data);
        } else {
            let now = self.env.now();
            self.push_event_to_user_index(
                UserIndexEvent::DailyPuzzleDataForMigratedUser(Box::new(user_index_canister::DailyPuzzleDataForMigratedUser {
                    user_id: new_user_id,
                    data: ByteBuf::from(msgpack::serialize_then_unwrap(&data)),
                })),
                now,
            );
        }
        info!(%old_user_id, %new_user_id, "Daily puzzle data moved to migrated user's new id");
    }

    // Sends events which were queued for a migrated user's old canister on to their latest id, in
    // order. If this LocalUserIndex doesn't hold them by that id, the events go via the UserIndex to
    // the one which does.
    pub fn push_events_queued_for_migrated_user(
        &mut self,
        old_user_id: UserId,
        events: Vec<IdempotentEnvelope<(UserId, UserEvent)>>,
    ) {
        let new_user_id = self.data.migrated_user_ids.latest(old_user_id);
        if events.is_empty() || new_user_id == old_user_id {
            return;
        }
        let now = self.env.now();
        if self.data.local_users.contains(&new_user_id) {
            // Stamped with the current time, since the MultiUser canister ignores any event from here
            // older than the latest it has had from here, and these may have been created before
            // events already sent to it
            let events = events
                .into_iter()
                .map(|event| IdempotentEnvelope {
                    created_at: now,
                    idempotency_id: event.idempotency_id,
                    value: (new_user_id, event.value.1),
                })
                .collect();
            self.data.user_events_queue.push_many(new_user_id.canister_id(), events);
        } else {
            for event in events {
                self.push_event_to_user_index(
                    UserIndexEvent::EventForMigratedUser(Box::new(user_index_canister::EventForMigratedUser {
                        user_id: new_user_id,
                        event: ByteBuf::from(msgpack::serialize_then_unwrap(&event.value.1)),
                    })),
                    now,
                );
            }
        }
    }

    // Events for a group this LocalUserIndex doesn't hold, eg. one which has been deleted, are
    // dropped, since they could never be delivered
    pub fn push_event_to_group(&mut self, canister_id: CanisterId, event: GroupEvent, now: TimestampMillis) {
        if !self.data.local_groups.contains(&canister_id.into()) {
            return;
        }
        self.data.group_event_sync_queue.push(
            canister_id,
            IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        );
    }

    // Events for a community this LocalUserIndex doesn't hold, eg. one which has been deleted, are
    // dropped, since they could never be delivered
    pub fn push_event_to_community(&mut self, canister_id: CanisterId, event: CommunityEvent, now: TimestampMillis) {
        if !self.data.local_communities.contains(&canister_id.into()) {
            return;
        }
        self.data.community_event_sync_queue.push(
            canister_id,
            IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        );
    }

    pub fn push_oc_bot_message_to_user(&mut self, user_id: UserId, content: MessageContentInitial, now: TimestampMillis) {
        if self.holds_latest_id_of(user_id) {
            self.push_event_to_user(
                user_id,
                UserEvent::OpenChatBotMessageV2(Box::new(user_canister::OpenChatBotMessageV2 {
                    thread_root_message_id: None,
                    content,
                    mentioned: Vec::new(),
                })),
                now,
            );
        } else {
            self.push_event_to_user_index(
                UserIndexEvent::OpenChatBotMessageV2(Box::new(user_index_canister::OpenChatBotMessageV2 {
                    user_id,
                    thread_root_message_id: None,
                    content,
                    mentioned: Vec::new(),
                })),
                now,
            );
        }
    }

    pub fn notify_user_joined_community(
        &mut self,
        user_id: UserId,
        community: &CommunityCanisterCommunitySummary,
        now: TimestampMillis,
    ) {
        let channels = community
            .channels
            .iter()
            .map(|c| ChannelLatestMessageIndex {
                channel_id: c.channel_id,
                latest_message_index: c.latest_message.as_ref().map(|m| m.event.message_index),
            })
            .collect();

        self.notify_user_joined_community_or_channel(user_id, community.community_id, channels, community.last_updated, now);
    }

    pub fn notify_user_joined_channel(
        &mut self,
        user_id: UserId,
        community_id: CommunityId,
        channel: &CommunityCanisterChannelSummary,
        now: TimestampMillis,
    ) {
        self.notify_user_joined_community_or_channel(
            user_id,
            community_id,
            vec![ChannelLatestMessageIndex {
                channel_id: channel.channel_id,
                latest_message_index: channel.latest_message.as_ref().map(|m| m.event.message_index),
            }],
            channel.last_updated,
            now,
        );
    }

    fn notify_user_joined_community_or_channel(
        &mut self,
        user_id: UserId,
        community_id: CommunityId,
        channels: Vec<ChannelLatestMessageIndex>,
        community_canister_timestamp: TimestampMillis,
        now: TimestampMillis,
    ) {
        self.record_join(user_id, community_id.into(), now);

        let local_user_index_canister_id = self.env.canister_id();
        if self.holds_latest_id_of(user_id) {
            self.push_event_to_user(
                user_id,
                UserEvent::UserJoinedCommunityOrChannel(Box::new(user_canister::UserJoinedCommunityOrChannel {
                    community_id,
                    local_user_index_canister_id,
                    channels,
                    community_canister_timestamp,
                })),
                now,
            );
        } else {
            self.push_event_to_user_index(
                UserIndexEvent::UserJoinedCommunityOrChannel(Box::new(user_index_canister::UserJoinedCommunityOrChannel {
                    user_id,
                    community_id,
                    local_user_index_canister_id,
                    channels,
                    community_canister_timestamp,
                })),
                now,
            );
        }
    }

    // Records that the user has joined the group or community, so that it can be told of their new id if
    // they turn out to be being migrated (see `RecentJoins`). If their migration has been heard of
    // already, while the join was in flight, it's told now.
    pub fn record_join(&mut self, user_id: UserId, canister_id: CanisterId, now: TimestampMillis) {
        let latest_user_id = self.data.migrated_user_ids.latest(user_id);
        if latest_user_id != user_id {
            self.notify_group_or_community_of_migrated_user_id(canister_id, user_id, latest_user_id, now);
        } else {
            self.data.recent_joins.push(user_id, canister_id, now);
        }
    }

    // Tells the group or community, if this LocalUserIndex holds it, that the user has been migrated
    pub fn notify_group_or_community_of_migrated_user_id(
        &mut self,
        canister_id: CanisterId,
        old_user_id: UserId,
        new_user_id: UserId,
        now: TimestampMillis,
    ) {
        if self.data.local_groups.get(&canister_id.into()).is_some() {
            self.push_event_to_group(
                canister_id,
                GroupEvent::UserIdMigrated(group_canister::UserIdMigrated {
                    old_user_id,
                    new_user_id,
                }),
                now,
            );
        } else if self.data.local_communities.get(&canister_id.into()).is_some() {
            self.push_event_to_community(
                canister_id,
                CommunityEvent::UserIdMigrated(community_canister::UserIdMigrated {
                    old_user_id,
                    new_user_id,
                }),
                now,
            );
        }
    }

    pub fn handle_notification(&mut self, notification: Notification, this_canister_id: CanisterId, now: TimestampMillis) {
        match notification {
            Notification::User(user_notification) => {
                let users_who_have_blocked_sender: HashSet<_> = user_notification
                    .sender
                    .map(|s| self.data.blocked_users.all_linked_users(s))
                    .unwrap_or_default();

                let filtered_recipients: Vec<_> = user_notification
                    .recipients
                    .into_iter()
                    .filter(|u| {
                        (self.data.web_push_subscriptions.any_for_user(u)
                            || !self.data.fcm_token_store.get_for_user(u).is_empty())
                            && !users_who_have_blocked_sender.contains(u)
                    })
                    .collect();

                let payload = user_notification.notification;
                let mut fcm_data: FcmData = payload.clone().into();

                // Native call pushes (#9456). Off, every push is what it was before native calls
                // and no dismissal leaves this canister. On, a call that the policy says should
                // ring gets the call fields, and a dismissal passes only for a call that rang.
                if let Some(rang) = call_push::dismissal_rang(&payload) {
                    if !self.data.call_push_enabled || !rang {
                        return;
                    }
                } else if self.data.call_push_enabled
                    && let Some((facts, true)) = call_push::ringing_call(&payload)
                {
                    fcm_data = fcm_data.set_call(&facts);
                }

                // A dismissal is only ever a data push to a phone
                let filtered_recipients: Vec<_> = if fcm_data.is_call_dismissal() {
                    filtered_recipients
                        .into_iter()
                        .filter(|u| !self.data.fcm_token_store.get_for_user(u).is_empty())
                        .collect()
                } else {
                    filtered_recipients
                };

                let notification_bytes = ByteBuf::from(msgpack::serialize_then_unwrap(&payload));

                // A ring push carries a decline token signed for its one recipient (#9534), so
                // each phone gets its own envelope. Recipients without a phone share one
                // envelope with no token; the token never travels in a web push.
                if let Some(call) = fcm_data.call.as_ref() {
                    let (phones, others): (Vec<_>, Vec<_>) = filtered_recipients
                        .into_iter()
                        .partition(|u| !self.data.fcm_token_store.get_for_user(u).is_empty());
                    let expiry = call.started + call_push::RING_WINDOW_MS;
                    let message_id = call.message_id;
                    for user_id in phones {
                        let data =
                            match self.sign_decline_token(user_id, fcm_data.chat_id, message_id, expiry, this_canister_id) {
                                Some(token) => fcm_data.clone().with_decline_token(token),
                                None => fcm_data.clone(),
                            };
                        self.add_user_notification(vec![user_id], notification_bytes.clone(), data, now);
                    }
                    if !others.is_empty() {
                        self.add_user_notification(others, notification_bytes, fcm_data, now);
                    }
                } else if !filtered_recipients.is_empty() {
                    self.add_user_notification(filtered_recipients, notification_bytes, fcm_data, now);
                }
            }
            Notification::Bot(bot_notification) => self.push_bot_notification(bot_notification, this_canister_id, now),
        }
    }

    fn add_user_notification(
        &mut self,
        recipients: Vec<UserId>,
        notification_bytes: ByteBuf,
        fcm_data: FcmData,
        now: TimestampMillis,
    ) {
        self.data
            .notifications
            .add(NotificationEnvelope::User(Box::new(UserNotificationEnvelope {
                recipients,
                notification_bytes,
                timestamp: now,
                fcm_data: Some(fcm_data),
            })));
    }

    // A JWT the video bridge verifies with the OpenChat public key: this user may decline
    // this call until the ring window ends (#9534). None when the key is not set.
    fn sign_decline_token(
        &mut self,
        user_id: UserId,
        chat_id: Chat,
        message_id: MessageId,
        expiry: TimestampMillis,
        this_canister_id: CanisterId,
    ) -> Option<String> {
        if !self.data.oc_key_pair.is_initialised() {
            return None;
        }
        let claims = Claims::new(
            expiry,
            CLAIM_TYPE_DECLINE_VIDEO_CALL.to_string(),
            DeclineVideoCallClaims {
                user_id,
                chat_id,
                message_id: message_id.to_string(),
                local_user_index: this_canister_id,
            },
        );
        sign_and_encode_token(self.data.oc_key_pair.secret_key_der(), claims, self.env.rng()).ok()
    }

    // The video bridge says this user declined the call: stop the ring on their other
    // devices. Nothing is stored and nobody else hears of it (#9534). Same rules as every
    // dismissal: only with the switch on, only to phones.
    pub fn push_call_declined(&mut self, user_id: UserId, chat_id: Chat, message_id: MessageId, now: TimestampMillis) {
        if !self.data.call_push_enabled || self.data.fcm_token_store.get_for_user(&user_id).is_empty() {
            return;
        }
        let payload = match chat_id {
            Chat::Direct(them) => UserNotificationPayload::DirectCallDismissed(DirectCallDismissedNotification {
                them: them.into(),
                message_id,
                kind: CallDismissalKind::DeclinedElsewhere,
            }),
            Chat::Group(chat_id) => UserNotificationPayload::GroupCallDismissed(GroupCallDismissedNotification {
                chat_id,
                message_id,
                kind: CallDismissalKind::DeclinedElsewhere,
                is_public: false,
                member_count: 1,
            }),
            // A channel never rings, so there is nothing to stop
            Chat::Channel(..) => return,
        };
        let fcm_data = FcmData::call_dismissal(chat_id, message_id, CallDismissalKind::DeclinedElsewhere);
        let notification_bytes = ByteBuf::from(msgpack::serialize_then_unwrap(&payload));
        self.add_user_notification(vec![user_id], notification_bytes, fcm_data, now);
    }

    pub fn push_bot_notification(
        &mut self,
        bot_notification: BotNotification,
        this_canister_id: CanisterId,
        now: TimestampMillis,
    ) {
        let recipients: HashMap<UserId, BotDataEncoding> = bot_notification
            .recipients
            .into_iter()
            .filter_map(|bot_id| self.data.bots.get(&bot_id).map(|bot| (bot_id, bot.data_encoding)))
            .collect();

        if recipients.is_empty() {
            return;
        }

        let encodings: HashSet<BotDataEncoding> = recipients.values().cloned().collect();

        let event_wrapper = BotEventWrapper {
            api_gateway: this_canister_id,
            event: bot_notification.event,
            timestamp: bot_notification.timestamp,
        };

        let event_map: HashMap<_, _> = encodings
            .into_iter()
            .filter_map(|encoding| {
                let secret_key_der = self.data.oc_key_pair.secret_key_der();
                let payload = match encoding {
                    BotDataEncoding::MsgPack => Some(msgpack::serialize_to_vec(&event_wrapper).unwrap()),
                    BotDataEncoding::Candid => Some(candid::encode_one(&event_wrapper).unwrap()),
                    BotDataEncoding::Json => {
                        error!("BotDataEncoding::Json is no longer supported");
                        None
                    }
                }?;

                let signature =
                    Base64UrlSafeNoPadding::encode_to_string(sign_bytes(&payload, secret_key_der, self.env.rng()).unwrap())
                        .ok()?;

                Some((
                    encoding,
                    BotEventPayload {
                        data: ByteBuf::from(payload),
                        signature,
                    },
                ))
            })
            .collect();

        if event_map.is_empty() {
            return;
        }

        self.data
            .notifications
            .add(NotificationEnvelope::Bot(BotNotificationEnvelope {
                recipients,
                timestamp: now,
                event_map,
            }));
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();
        let user_upgrades_metrics = self.data.users_requiring_upgrade.metrics();
        let group_upgrades_metrics = self.data.groups_requiring_upgrade.metrics();
        let community_upgrades_metrics = self.data.communities_requiring_upgrade.metrics();
        let multi_user_upgrades_metrics = self.data.multi_users_requiring_upgrade.metrics();
        let event_store_client_info = self.data.event_store_client.info();
        let event_relay_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_user_count: self.data.local_users.len() as u64,
            local_group_count: self.data.local_groups.len() as u64,
            local_community_count: self.data.local_communities.len() as u64,
            local_multi_user_count: self.data.local_multi_user_canisters.len() as u64,
            global_user_count: self.data.global_users.len() as u64,
            multi_user_canister_count: self.data.global_users.multi_user_canisters().len() as u64,
            bot_user_count: self.data.global_users.legacy_bots().len() as u64,
            oc_controlled_bots: self.data.global_users.oc_controlled_bots().iter().copied().collect(),
            platform_moderators: self.data.global_users.platform_moderators().len() as u32,
            platform_operators: self.data.global_users.platform_operators().len() as u32,
            user_upgrades_completed: user_upgrades_metrics.completed,
            user_upgrades_pending: user_upgrades_metrics.pending,
            user_upgrades_in_progress: user_upgrades_metrics.in_progress,
            user_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::User).wasm.version,
            user_upgrade_concurrency: self.data.user_upgrade_concurrency,
            max_concurrent_user_upgrades: self.data.max_concurrent_user_upgrades,
            group_upgrades_completed: group_upgrades_metrics.completed,
            group_upgrades_pending: group_upgrades_metrics.pending,
            group_upgrades_in_progress: group_upgrades_metrics.in_progress,
            group_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::Group).wasm.version,
            group_upgrade_concurrency: self.data.group_upgrade_concurrency,
            max_concurrent_group_upgrades: self.data.max_concurrent_group_upgrades,
            community_upgrades_completed: community_upgrades_metrics.completed,
            community_upgrades_pending: community_upgrades_metrics.pending,
            community_upgrades_in_progress: community_upgrades_metrics.in_progress,
            community_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::Community).wasm.version,
            community_upgrade_concurrency: self.data.community_upgrade_concurrency,
            max_concurrent_community_upgrades: self.data.max_concurrent_community_upgrades,
            multi_user_upgrades_completed: multi_user_upgrades_metrics.completed,
            multi_user_upgrades_pending: multi_user_upgrades_metrics.pending,
            multi_user_upgrades_in_progress: multi_user_upgrades_metrics.in_progress,
            multi_user_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::MultiUser).wasm.version,
            multi_user_canisters_enabled: self.data.multi_user_canisters_enabled,
            migrated_user_ids: self.data.migrated_user_ids.len(),
            call_push_enabled: self.data.call_push_enabled,
            user_versions: self
                .data
                .local_users
                .iter_user_canisters()
                .filter_map(|u| u.1.wasm_version)
                .map(|v| v.to_string())
                .count_per_value(),
            group_versions: self
                .data
                .local_groups
                .iter()
                .map(|u| u.1.wasm_version.to_string())
                .count_per_value(),
            community_versions: self
                .data
                .local_communities
                .iter()
                .map(|u| u.1.wasm_version.to_string())
                .count_per_value(),
            multi_user_versions: self
                .data
                .local_multi_user_canisters
                .iter()
                .map(|u| u.1.wasm_version.to_string())
                .count_per_value(),
            user_upgrades_failed: user_upgrades_metrics.failed,
            group_upgrades_failed: group_upgrades_metrics.failed,
            community_upgrades_failed: community_upgrades_metrics.failed,
            multi_user_upgrades_failed: multi_user_upgrades_metrics.failed,
            recent_user_upgrades: user_upgrades_metrics.recently_competed,
            recent_group_upgrades: group_upgrades_metrics.recently_competed,
            recent_community_upgrades: community_upgrades_metrics.recently_competed,
            recent_multi_user_upgrades: multi_user_upgrades_metrics.recently_competed,
            user_events_queue_length: self.data.user_events_queue.len(),
            user_events_queue_in_progress: self.data.user_events_queue.in_progress(),
            group_events_queue_length: self.data.group_event_sync_queue.len(),
            community_events_queue_length: self.data.community_event_sync_queue.len(),
            users_to_delete_queue_length: self.data.users_to_delete_queue.len(),
            users_to_migrate_pending: self.data.users_to_migrate.pending(),
            users_to_migrate_in_progress: self.data.users_to_migrate.in_progress(),
            users_to_import_pending: self.data.users_to_import.pending(),
            users_to_import_in_progress: self.data.users_to_import.in_progress(),
            users_to_close_out_pending: self.data.users_to_close_out.pending(),
            users_to_close_out_in_progress: self.data.users_to_close_out.in_progress(),
            recent_joins: self.data.recent_joins.len(),
            chunk_store: crate::jobs::refresh_chunk_store::metrics(),
            cycles_refund_queue_length: self.data.cycles_refund_queue.len(),
            cycles_refunded_from_deleted_users: self.data.cycles_refunded_from_deleted_users,
            cycles_refunded_from_pool_canisters: self.data.cycles_refunded_from_pool_canisters,
            cycles_topped_up_for_refunds: self.data.cycles_topped_up_for_refunds,
            registry_tokens: self.data.registry_tokens.len(),
            referral_codes: self.data.referral_codes.metrics(now),
            event_store_client_info,
            notification_pushers: self.data.notification_pushers.iter().copied().collect(),
            queued_notifications: self.data.notifications.len() as u32,
            latest_notification_index: self.data.notifications.latest_event_index(),
            web_push_subscriptions: self.data.web_push_subscriptions.total(),
            fcm_token_count: self.data.fcm_token_store.len(),
            blocked_user_pairs: self.data.blocked_users.len() as u64,
            oc_secret_key_initialized: self.data.oc_key_pair.is_initialised(),
            openai_api_key_set: self.data.openai_api_key.is_some(),
            moderation_referral_config: self.data.moderation_referral_config.clone(),
            message_moderation_queue_len: self.data.message_moderation_queue.len() as u32,
            media_scanning_enabled: self.data.media_scan_config.enabled,
            media_scan_job_log_len: self.data.media_scan_job_log.len() as u32,
            media_scan_latest_job_index: self.data.media_scan_job_log.latest_job_index(),
            media_scan_last_verdict_at: self.data.media_scan_job_log.last_verdict_at(),
            media_scan_jobs_dropped: self.data.media_scan_job_log.dropped(),
            cycles_balance_check_queue_len: self.data.cycles_balance_check_queue.len() as u32,
            daily_puzzle: DailyPuzzleMetrics {
                canister_id: self.data.daily_puzzle_canister_id,
                engine: self.data.daily_puzzle_engine.metrics(),
                results_queue_len: self.data.daily_puzzle_results_queue.as_ref().map_or(0, |q| q.len()),
                chit_credit_retry_queue_len: self.data.game_chit_credit_retry_queue.len(),
            },
            bots: self
                .data
                .bots
                .iter()
                .map(|b| BotMetrics {
                    user_id: b.bot_id,
                    name: b.name.clone(),
                    commands: b.commands.iter().map(|c| c.name.clone()).collect(),
                })
                .collect(),
            blocked_username_patterns: self.data.blocked_username_patterns.clone(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                notifications_index: self.data.notifications_index_canister_id,
                identity: self.data.identity_canister_id,
                proposals_bot: self.data.proposals_bot_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
                escrow: self.data.escrow_canister_id,
                event_relay: event_relay_canister_id,
                internet_identity: self.data.internet_identity_canister_id,
                website: self.data.website_canister_id,
                daily_puzzle: self.data.daily_puzzle_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub local_users: LocalUserMap,
    pub local_groups: LocalGroupMap,
    pub local_communities: LocalCommunityMap,
    #[serde(default, alias = "local_multi_users")]
    pub local_multi_user_canisters: LocalMultiUserCanisterMap,
    pub global_users: GlobalUserMap,
    pub bots: BotsMap,
    pub child_canister_wasms: ChildCanisterWasms<ChildCanisterType>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub online_users_canister_id: CanisterId,
    pub registry_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub users_requiring_upgrade: CanistersRequiringUpgrade,
    pub groups_requiring_upgrade: CanistersRequiringUpgrade,
    pub communities_requiring_upgrade: CanistersRequiringUpgrade,
    #[serde(default)]
    pub multi_users_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub user_index_event_sync_queue: BatchedTimerJobQueue<UserIndexEventBatch>,
    #[serde(default = "new_user_events_queue")]
    pub user_events_queue: GroupedTimerJobQueue<UserEventBatch>,
    pub group_event_sync_queue: GroupedTimerJobQueue<GroupEventBatch>,
    pub community_event_sync_queue: GroupedTimerJobQueue<CommunityEventBatch>,
    pub test_mode: bool,
    pub max_concurrent_user_upgrades: u32,
    pub user_upgrade_concurrency: u32,
    pub max_concurrent_group_upgrades: u32,
    pub group_upgrade_concurrency: u32,
    pub max_concurrent_community_upgrades: u32,
    pub community_upgrade_concurrency: u32,
    pub platform_moderators_group: Option<ChatId>,
    pub referral_codes: ReferralCodes,
    pub rng_seed: [u8; 32],
    pub video_call_operators: Vec<Principal>,
    pub oc_key_pair: P256KeyPair,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub event_deduper: EventDeduper,
    pub users_to_delete_queue: VecDeque<UserToDelete>,
    #[serde(default)]
    pub cycles_refund_queue: VecDeque<CanisterToRefund>,
    #[serde(default)]
    pub cycles_refunded_from_deleted_users: Cycles,
    #[serde(default)]
    pub cycles_refunded_from_pool_canisters: Cycles,
    #[serde(default)]
    pub cycles_topped_up_for_refunds: Cycles,
    pub events_for_remote_users: Vec<(UserId, UserEvent)>,
    pub cycles_balance_check_queue: VecDeque<CanisterId>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub idempotency_checker: IdempotencyChecker,
    pub notification_pushers: HashSet<Principal>,
    pub web_push_subscriptions: WebPushSubscriptions,
    pub notifications: EventStream<NotificationEnvelope>,
    pub blocked_users: UserIdsSet,
    pub fcm_token_store: FcmTokenStore,
    pub premium_items: PremiumItems,
    pub blocked_username_patterns: Vec<String>,
    pub openai_api_key: Option<String>,
    #[serde(default)]
    pub moderation_referral_config: Option<ModerationReferralConfig>,
    #[serde(default)]
    pub message_moderation_queue: ModerationQueue,
    #[serde(default)]
    pub media_scan_config: MediaScanConfig,
    #[serde(default)]
    pub media_scan_job_log: MediaScanJobLog,
    // Mirrors the flag on the UserIndex. While set, new users are placed in whichever MultiUser
    // canister has the fewest users
    #[serde(default)]
    pub multi_user_canisters_enabled: bool,
    // The native call push kill switch (#9456). Off until the Android shell can ring.
    #[serde(default)]
    pub call_push_enabled: bool,
    #[serde(default)]
    pub daily_puzzle_canister_id: Option<CanisterId>,
    #[serde(default)]
    pub daily_puzzle_engine: DailyPuzzleEngine,
    // Created when the daily puzzle canister id is set, since the queue needs a target
    #[serde(default)]
    pub daily_puzzle_results_queue: Option<BatchedTimerJobQueue<DailyPuzzleResultBatch>>,
    // Solve rewards whose credit call failed after the solve was recorded
    #[serde(default = "new_retry_queue")]
    pub game_chit_credit_retry_queue: GameChitCreditRetryQueue,
    // The old id -> the new id of each user migrated to a MultiUser canister, synced from the
    // UserIndex
    #[serde(default)]
    pub migrated_user_ids: MigratedUserIds,
    // Users the UserIndex has asked this LocalUserIndex to start migrating to MultiUser canisters
    #[serde(default)]
    pub users_to_migrate: UsersToMigrate,
    // Users the UserIndex has asked this LocalUserIndex to have one of its MultiUser canisters import
    #[serde(default)]
    pub users_to_import: UsersToMigrate<UserToImport>,
    // Users switched over to the MultiUser canister they were migrated to, whose old canisters, which
    // this LocalUserIndex controls, are to be uninstalled
    #[serde(default)]
    pub users_to_close_out: UsersToMigrate<UserToCloseOut>,
    // The groups and communities users have recently joined via this LocalUserIndex, which are told
    // of a user's new id if they turn out to have been being migrated
    #[serde(default)]
    pub recent_joins: RecentJoins,
    // The ledgers from which migrated users' funds can be moved, refreshed from the Registry daily
    #[serde(default)]
    pub registry_tokens: RegistryTokens,
    // Rebuilt every 5 minutes (and on start) from the child canisters' top ups, so not persisted
    #[serde(skip)]
    pub top_up_leaderboards: TopUpLeaderboards,
}

#[derive(Serialize, Deserialize)]
pub struct FailedMessageUsers {
    pub sender: UserId,
    pub recipient: UserId,
}

#[derive(Serialize, Deserialize)]
pub struct UserToDelete {
    pub user_id: UserId,
    #[serde(default)]
    #[deprecated]
    pub triggered_by_user: bool,
    pub attempt: usize,
}

// An uninstalled canister whose cycles are to be sent to the CyclesDispenser
#[derive(Serialize, Deserialize, Clone)]
pub struct CanisterToRefund {
    pub canister_id: CanisterId,
    pub attempt: usize,
    pub retry_after: TimestampMillis,
    // Set for a canister from the canister pool, which goes back into the pool once its cycles have
    // been refunded
    #[serde(default)]
    pub return_to_pool: bool,
}

impl Data {
    #[expect(clippy::too_many_arguments)]
    pub fn new(
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
        online_users_canister_id: CanisterId,
        registry_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        website_canister_id: CanisterId,
        canister_pool_target_size: u16,
        video_call_operators: Vec<Principal>,
        oc_secret_key_der: Vec<u8>,
        openai_api_key: Option<String>,
        moderation_referral_config: Option<ModerationReferralConfig>,
        media_scan_config: MediaScanConfig,
        multi_user_canisters_enabled: bool,
        call_push_enabled: bool,
        test_mode: bool,
    ) -> Self {
        Data {
            local_users: LocalUserMap::default(),
            local_groups: LocalGroupMap::default(),
            local_communities: LocalCommunityMap::default(),
            local_multi_user_canisters: LocalMultiUserCanisterMap::default(),
            global_users: GlobalUserMap::default(),
            child_canister_wasms: ChildCanisterWasms::default(),
            user_index_canister_id,
            group_index_canister_id,
            notifications_index_canister_id,
            identity_canister_id,
            proposals_bot_canister_id,
            cycles_dispenser_canister_id,
            escrow_canister_id,
            online_users_canister_id,
            registry_canister_id,
            internet_identity_canister_id,
            website_canister_id,
            users_requiring_upgrade: CanistersRequiringUpgrade::default(),
            groups_requiring_upgrade: CanistersRequiringUpgrade::default(),
            communities_requiring_upgrade: CanistersRequiringUpgrade::default(),
            multi_users_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            user_events_queue: new_user_events_queue(),
            group_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            community_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            user_index_event_sync_queue: BatchedTimerJobQueue::new(user_index_canister_id, true),
            test_mode,
            max_concurrent_user_upgrades: 10,
            user_upgrade_concurrency: 10,
            max_concurrent_group_upgrades: 10,
            group_upgrade_concurrency: 10,
            max_concurrent_community_upgrades: 10,
            community_upgrade_concurrency: 10,
            platform_moderators_group: None,
            referral_codes: ReferralCodes::default(),
            rng_seed: [0; 32],
            notification_pushers: HashSet::new(),
            video_call_operators,
            oc_key_pair: P256KeyPair::from_secret_key_der(oc_secret_key_der).unwrap(),
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_millis(MINUTE_IN_MS))
                .build(),
            event_deduper: EventDeduper::default(),
            users_to_delete_queue: VecDeque::new(),
            cycles_refund_queue: VecDeque::new(),
            cycles_refunded_from_deleted_users: 0,
            cycles_refunded_from_pool_canisters: 0,
            cycles_topped_up_for_refunds: 0,
            events_for_remote_users: Vec::new(),
            cycles_balance_check_queue: VecDeque::new(),
            bots: BotsMap::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            idempotency_checker: IdempotencyChecker::default(),
            web_push_subscriptions: WebPushSubscriptions::default(),
            notifications: EventStream::default(),
            blocked_users: UserIdsSet::new(UserIdsKeyPrefix::new_for_blocked_users()),
            fcm_token_store: FcmTokenStore::default(),
            premium_items: PremiumItems::default(),
            blocked_username_patterns: Vec::new(),
            openai_api_key,
            moderation_referral_config,
            message_moderation_queue: ModerationQueue::default(),
            media_scan_config,
            media_scan_job_log: MediaScanJobLog::default(),
            multi_user_canisters_enabled,
            call_push_enabled,
            daily_puzzle_canister_id: None,
            daily_puzzle_engine: DailyPuzzleEngine::default(),
            daily_puzzle_results_queue: None,
            game_chit_credit_retry_queue: new_retry_queue(),
            migrated_user_ids: MigratedUserIds::default(),
            users_to_migrate: UsersToMigrate::default(),
            users_to_import: UsersToMigrate::default(),
            users_to_close_out: UsersToMigrate::default(),
            recent_joins: RecentJoins::default(),
            registry_tokens: RegistryTokens::default(),
            top_up_leaderboards: TopUpLeaderboards::default(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub local_user_count: u64,
    pub local_group_count: u64,
    pub local_community_count: u64,
    pub local_multi_user_count: u64,
    pub global_user_count: u64,
    pub multi_user_canister_count: u64,
    pub bot_user_count: u64,
    pub oc_controlled_bots: Vec<UserId>,
    pub platform_moderators: u32,
    pub platform_operators: u32,
    pub canisters_in_pool: u16,
    pub user_upgrades_completed: u64,
    pub user_upgrades_pending: u64,
    pub user_upgrades_in_progress: u64,
    pub user_wasm_version: BuildVersion,
    pub user_upgrade_concurrency: u32,
    pub max_concurrent_user_upgrades: u32,
    pub group_upgrades_completed: u64,
    pub group_upgrades_pending: u64,
    pub group_upgrades_in_progress: u64,
    pub group_wasm_version: BuildVersion,
    pub group_upgrade_concurrency: u32,
    pub max_concurrent_group_upgrades: u32,
    pub community_upgrades_completed: u64,
    pub community_upgrades_pending: u64,
    pub community_upgrades_in_progress: u64,
    pub community_wasm_version: BuildVersion,
    pub community_upgrade_concurrency: u32,
    pub max_concurrent_community_upgrades: u32,
    pub multi_user_upgrades_completed: u64,
    pub multi_user_upgrades_pending: u64,
    pub multi_user_upgrades_in_progress: u64,
    pub multi_user_wasm_version: BuildVersion,
    pub multi_user_canisters_enabled: bool,
    pub migrated_user_ids: usize,
    pub call_push_enabled: bool,
    pub user_events_queue_length: usize,
    // Batches currently mid-flight: len() alone cannot distinguish an idle queue from one
    // whose last batch is still awaiting its reply
    pub user_events_queue_in_progress: usize,
    pub group_events_queue_length: usize,
    pub community_events_queue_length: usize,
    pub users_to_delete_queue_length: usize,
    pub users_to_migrate_pending: usize,
    pub users_to_migrate_in_progress: usize,
    pub users_to_import_pending: usize,
    pub users_to_import_in_progress: usize,
    pub users_to_close_out_pending: usize,
    pub users_to_close_out_in_progress: usize,
    pub recent_joins: usize,
    pub chunk_store: crate::jobs::refresh_chunk_store::ChunkStoreMetrics,
    pub cycles_refund_queue_length: usize,
    pub cycles_refunded_from_deleted_users: Cycles,
    pub cycles_refunded_from_pool_canisters: Cycles,
    pub cycles_topped_up_for_refunds: Cycles,
    pub registry_tokens: usize,
    pub referral_codes: HashMap<ReferralType, ReferralTypeMetrics>,
    pub event_store_client_info: EventStoreClientInfo,
    pub user_versions: BTreeMap<String, u32>,
    pub group_versions: BTreeMap<String, u32>,
    pub community_versions: BTreeMap<String, u32>,
    pub multi_user_versions: BTreeMap<String, u32>,
    pub user_upgrades_failed: Vec<FailedUpgradeCount>,
    pub group_upgrades_failed: Vec<FailedUpgradeCount>,
    pub community_upgrades_failed: Vec<FailedUpgradeCount>,
    pub multi_user_upgrades_failed: Vec<FailedUpgradeCount>,
    pub recent_user_upgrades: Vec<CanisterId>,
    pub recent_group_upgrades: Vec<CanisterId>,
    pub recent_community_upgrades: Vec<CanisterId>,
    pub recent_multi_user_upgrades: Vec<CanisterId>,
    pub notification_pushers: Vec<Principal>,
    pub queued_notifications: u32,
    pub latest_notification_index: u64,
    pub web_push_subscriptions: u64,
    pub fcm_token_count: usize,
    pub blocked_user_pairs: u64,
    pub oc_secret_key_initialized: bool,
    pub openai_api_key_set: bool,
    pub moderation_referral_config: Option<ModerationReferralConfig>,
    pub message_moderation_queue_len: u32,
    pub media_scanning_enabled: bool,
    pub media_scan_job_log_len: u32,
    pub media_scan_latest_job_index: u64,
    pub media_scan_last_verdict_at: TimestampMillis,
    pub media_scan_jobs_dropped: u64,
    pub cycles_balance_check_queue_len: u32,
    pub bots: Vec<BotMetrics>,
    pub blocked_username_patterns: Vec<String>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub daily_puzzle: DailyPuzzleMetrics,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct DailyPuzzleMetrics {
    pub canister_id: Option<CanisterId>,
    pub engine: DailyPuzzleEngineMetrics,
    pub results_queue_len: usize,
    pub chit_credit_retry_queue_len: usize,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub identity: CanisterId,
    pub proposals_bot: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub escrow: CanisterId,
    pub event_relay: CanisterId,
    pub internet_identity: CanisterId,
    pub website: CanisterId,
    pub daily_puzzle: Option<CanisterId>,
}

#[derive(Serialize, Debug)]
pub struct BotMetrics {
    pub user_id: UserId,
    pub name: String,
    pub commands: Vec<String>,
}

fn new_user_events_queue() -> GroupedTimerJobQueue<UserEventBatch> {
    GroupedTimerJobQueue::new(10, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use utils::env::test::TestEnv;

    // Eg. for a group or community which has been deleted. Queueing an event for a local group or
    // community starts sending it, which can't be done outside of a canister, so isn't tested here.
    #[test]
    fn events_for_groups_and_communities_which_are_not_local_are_dropped() {
        let mut state = setup_runtime_state();
        let canister_id = Principal::from_slice(&[10]);
        let bot_id = Principal::from_slice(&[11]).into();

        state.push_event_to_group(canister_id, GroupEvent::BotRemoved(bot_id), 0);
        state.push_event_to_community(canister_id, CommunityEvent::BotRemoved(bot_id), 0);

        assert_eq!(state.data.group_event_sync_queue.len(), 0);
        assert_eq!(state.data.community_event_sync_queue.len(), 0);
    }

    pub(crate) fn setup_runtime_state() -> RuntimeState {
        let canister_id = Principal::from_slice(&[1]);
        let data = Data::new(
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            canister_id,
            0,
            Vec::new(),
            P256KeyPair::new(&mut rand::rng()).secret_key_der().to_vec(),
            None,
            None,
            MediaScanConfig::default(),
            true,
            false,
            true,
        );
        RuntimeState::new(Box::new(TestEnv::default()), data)
    }
}
