use crate::model::community_event_batch::CommunityEventBatch;
use crate::model::group_event_batch::GroupEventBatch;
use crate::model::local_community_map::LocalCommunityMap;
use crate::model::local_group_map::LocalGroupMap;
use crate::model::referral_codes::{ReferralCodes, ReferralTypeMetrics};
use crate::model::user_event_batch::UserEventBatch;
use crate::model::user_index_event_batch::UserIndexEventBatch;
use crate::model::web_push_subscriptions::WebPushSubscriptions;
use candid::Principal;
use canister_state_macros::canister_state;
use community_canister::LocalIndexEvent as CommunityEvent;
use constants::{CYCLES_REQUIRED_FOR_UPGRADE, MINUTE_IN_MS};
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use event_store_utils::EventDeduper;
use fire_and_forget_handler::FireAndForgetHandler;
use group_canister::LocalIndexEvent as GroupEvent;
use jwt::{Claims, verify_and_decode};
use local_user_index_canister::{ChildCanisterType, GlobalUser};
use model::bots_map::BotsMap;
use model::global_user_map::GlobalUserMap;
use model::local_user_map::LocalUserMap;
use p256_key_pair::P256KeyPair;
use proof_of_unique_personhood::verify_proof_of_unique_personhood;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use stable_memory_map::UserIdsKeyPrefix;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::time::Duration;
use timer_job_queues::{BatchedTimerJobQueue, GroupedTimerJobQueue};
use types::{
    BotDataEncoding, BotEventWrapper, BotNotification, BotNotificationEnvelope, BuildVersion, CanisterId,
    ChannelLatestMessageIndex, ChatId, ChildCanisterWasms, CommunityCanisterChannelSummary, CommunityCanisterCommunitySummary,
    CommunityId, Cycles, DiamondMembershipDetails, IdempotentEnvelope, MessageContent, Milliseconds, Notification,
    NotificationEnvelope, ReferralType, TimestampMillis, Timestamped, UserId, UserNotificationEnvelope,
    VerifiedCredentialGateArgs,
};
use user_canister::LocalUserIndexEvent as UserEvent;
use user_ids_set::UserIdsSet;
use user_index_canister::LocalUserIndexEvent as UserIndexEvent;
use utils::canister;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;
use utils::event_stream::EventStream;
use utils::fcm_token_store::FcmTokenStore;
use utils::idempotency_checker::IdempotencyChecker;
use utils::iterator_extensions::IteratorExtensions;

mod bots;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const CHILD_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + CHILD_CANISTER_TOP_UP_AMOUNT; // 0.5T cycles
const CHILD_CANISTER_TOP_UP_AMOUNT: Cycles = 200_000_000_000; // 0.2T cycles
const MARK_ACTIVE_DURATION: Milliseconds = 10 * 60 * 1000; // 10 minutes

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
                    &self.data.ic_root_key,
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
                } else if let Ok(claims) =
                    verify_and_decode::<Claims<DiamondMembershipDetails>>(jwt, self.data.oc_key_pair.public_key_pem())
                {
                    if claims.claim_type() == "diamond_membership" {
                        let expires_at = claims.custom().expires_at;
                        user_details.diamond_membership_expires_at = Some(expires_at);
                        self.data.global_users.set_diamond_membership_expiry_date(user_id, expires_at);
                    }
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
    }

    pub fn is_caller_notification_pusher(&self) -> bool {
        let caller = self.env.caller();
        self.data.notification_pushers.contains(&caller)
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

    pub fn push_event_to_user_index(&mut self, event: UserIndexEvent, now: TimestampMillis) {
        self.data.user_index_event_sync_queue.push(IdempotentEnvelope {
            created_at: now,
            idempotency_id: self.env.rng().next_u64(),
            value: event,
        });
    }

    pub fn push_event_to_user(&mut self, user_id: UserId, event: UserEvent, now: TimestampMillis) {
        self.data.user_event_sync_queue.push(
            user_id,
            IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        );
    }

    pub fn push_event_to_group(&mut self, canister_id: CanisterId, event: GroupEvent, now: TimestampMillis) {
        self.data.group_event_sync_queue.push(
            canister_id,
            IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        );
    }

    pub fn push_event_to_community(&mut self, canister_id: CanisterId, event: CommunityEvent, now: TimestampMillis) {
        self.data.community_event_sync_queue.push(
            canister_id,
            IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        );
    }

    pub fn push_oc_bot_message_to_user(&mut self, user_id: UserId, content: MessageContent, now: TimestampMillis) {
        if self.data.local_users.contains(&user_id) {
            self.push_event_to_user(user_id, UserEvent::OpenChatBotMessage(Box::new(content)), now);
        } else {
            self.push_event_to_user_index(
                UserIndexEvent::OpenChatBotMessage(Box::new(user_index_canister::OpenChatBotMessage {
                    user_id,
                    message: content,
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
        let local_user_index_canister_id = self.env.canister_id();
        if self.data.local_users.get(&user_id).is_some() {
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

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();
        let user_upgrades_metrics = self.data.users_requiring_upgrade.metrics();
        let group_upgrades_metrics = self.data.groups_requiring_upgrade.metrics();
        let community_upgrades_metrics = self.data.communities_requiring_upgrade.metrics();
        let event_store_client_info = self.data.event_store_client.info();
        let event_relay_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_user_count: self.data.local_users.len() as u64,
            local_group_count: self.data.local_groups.len() as u64,
            local_community_count: self.data.local_communities.len() as u64,
            global_user_count: self.data.global_users.len() as u64,
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
            user_versions: self
                .data
                .local_users
                .iter()
                .map(|u| u.1.wasm_version.to_string())
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
            user_upgrades_failed: user_upgrades_metrics.failed,
            group_upgrades_failed: group_upgrades_metrics.failed,
            community_upgrades_failed: community_upgrades_metrics.failed,
            recent_user_upgrades: user_upgrades_metrics.recently_competed,
            recent_group_upgrades: group_upgrades_metrics.recently_competed,
            recent_community_upgrades: community_upgrades_metrics.recently_competed,
            user_events_queue_length: self.data.user_event_sync_queue.len(),
            users_to_delete_queue_length: self.data.users_to_delete_queue.len(),
            referral_codes: self.data.referral_codes.metrics(now),
            event_store_client_info,
            notification_pushers: self.data.notification_pushers.iter().copied().collect(),
            queued_notifications: self.data.notifications.len() as u32,
            latest_notification_index: self.data.notifications.latest_event_index(),
            web_push_subscriptions: self.data.web_push_subscriptions.total(),
            fcm_token_count: self.data.fcm_token_store.len(),
            blocked_user_pairs: self.data.blocked_users.len() as u64,
            oc_secret_key_initialized: self.data.oc_key_pair.is_initialised(),
            cycles_balance_check_queue_len: self.data.cycles_balance_check_queue.len() as u32,
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
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub local_users: LocalUserMap,
    pub local_groups: LocalGroupMap,
    pub local_communities: LocalCommunityMap,
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
    pub internet_identity_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub users_requiring_upgrade: CanistersRequiringUpgrade,
    pub groups_requiring_upgrade: CanistersRequiringUpgrade,
    pub communities_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub user_index_event_sync_queue: BatchedTimerJobQueue<UserIndexEventBatch>,
    pub user_event_sync_queue: GroupedTimerJobQueue<UserEventBatch>,
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
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub events_for_remote_users: Vec<(UserId, UserEvent)>,
    pub cycles_balance_check_queue: VecDeque<CanisterId>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub idempotency_checker: IdempotencyChecker,
    pub notification_pushers: HashSet<Principal>,
    pub web_push_subscriptions: WebPushSubscriptions,
    pub notifications: EventStream<NotificationEnvelope>,
    pub blocked_users: UserIdsSet,
    pub fcm_token_store: FcmTokenStore,
}

#[derive(Serialize, Deserialize)]
pub struct FailedMessageUsers {
    pub sender: UserId,
    pub recipient: UserId,
}

#[derive(Serialize, Deserialize)]
pub struct UserToDelete {
    pub user_id: UserId,
    pub triggered_by_user: bool,
    pub attempt: usize,
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
        internet_identity_canister_id: CanisterId,
        website_canister_id: CanisterId,
        canister_pool_target_size: u16,
        video_call_operators: Vec<Principal>,
        oc_secret_key_der: Option<Vec<u8>>,
        ic_root_key: Vec<u8>,
        test_mode: bool,
    ) -> Self {
        Data {
            local_users: LocalUserMap::default(),
            local_groups: LocalGroupMap::default(),
            local_communities: LocalCommunityMap::default(),
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
            internet_identity_canister_id,
            website_canister_id,
            users_requiring_upgrade: CanistersRequiringUpgrade::default(),
            groups_requiring_upgrade: CanistersRequiringUpgrade::default(),
            communities_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            user_event_sync_queue: GroupedTimerJobQueue::new(10, false),
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
            oc_key_pair: oc_secret_key_der
                .map(|sk| P256KeyPair::from_secret_key_der(sk).unwrap())
                .unwrap_or_default(),
            event_store_client: EventStoreClientBuilder::new(event_relay_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_millis(MINUTE_IN_MS))
                .build(),
            event_deduper: EventDeduper::default(),
            users_to_delete_queue: VecDeque::new(),
            ic_root_key,
            events_for_remote_users: Vec::new(),
            cycles_balance_check_queue: VecDeque::new(),
            bots: BotsMap::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            idempotency_checker: IdempotencyChecker::default(),
            web_push_subscriptions: WebPushSubscriptions::default(),
            notifications: EventStream::default(),
            blocked_users: UserIdsSet::new(UserIdsKeyPrefix::new_for_blocked_users()),
            fcm_token_store: FcmTokenStore::default(),
        }
    }

    pub fn handle_notification(&mut self, notification: Notification, this_canister_id: CanisterId, now: TimestampMillis) {
        match notification {
            Notification::User(user_notification) => {
                let Some(notification_bytes) = user_notification.notification_bytes.or_else(|| {
                    user_notification
                        .notification
                        .as_ref()
                        .map(msgpack::serialize_then_unwrap)
                        .map(ByteBuf::from)
                }) else {
                    return;
                };

                let users_who_have_blocked_sender: HashSet<_> = user_notification
                    .sender
                    .map(|s| self.blocked_users.all_linked_users(s))
                    .unwrap_or_default();

                let filtered_recipients: Vec<_> = user_notification
                    .recipients
                    .into_iter()
                    .filter(|u| {
                        (self.web_push_subscriptions.any_for_user(u) || !self.fcm_token_store.get_for_user(u).is_empty())
                            && !users_who_have_blocked_sender.contains(u)
                    })
                    .collect();

                if !filtered_recipients.is_empty() {
                    self.notifications.add(NotificationEnvelope::User(UserNotificationEnvelope {
                        recipients: filtered_recipients,
                        notification_bytes,
                        timestamp: now,
                        fcm_data: user_notification.notification.map(|n| n.to_fcm_data()),
                    }));
                }
            }
            Notification::Bot(bot_notification) => self.push_bot_notification(bot_notification, this_canister_id, now),
        }
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
            .filter_map(|bot_id| self.bots.get(&bot_id).map(|bot| (bot_id, bot.data_encoding)))
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

        let notification_bytes = encodings
            .into_iter()
            .map(|encoding| {
                let bytes = match encoding {
                    BotDataEncoding::Json => serde_json::to_vec(&event_wrapper).unwrap(),
                    BotDataEncoding::Candid => candid::encode_one(&event_wrapper).unwrap(),
                };
                (encoding, ByteBuf::from(bytes))
            })
            .collect();

        self.notifications.add(NotificationEnvelope::Bot(BotNotificationEnvelope {
            recipients,
            timestamp: now,
            notification_bytes,
        }));
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
    pub global_user_count: u64,
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
    pub user_events_queue_length: usize,
    pub users_to_delete_queue_length: usize,
    pub referral_codes: HashMap<ReferralType, ReferralTypeMetrics>,
    pub event_store_client_info: EventStoreClientInfo,
    pub user_versions: BTreeMap<String, u32>,
    pub group_versions: BTreeMap<String, u32>,
    pub community_versions: BTreeMap<String, u32>,
    pub user_upgrades_failed: Vec<FailedUpgradeCount>,
    pub group_upgrades_failed: Vec<FailedUpgradeCount>,
    pub community_upgrades_failed: Vec<FailedUpgradeCount>,
    pub recent_user_upgrades: Vec<CanisterId>,
    pub recent_group_upgrades: Vec<CanisterId>,
    pub recent_community_upgrades: Vec<CanisterId>,
    pub notification_pushers: Vec<Principal>,
    pub queued_notifications: u32,
    pub latest_notification_index: u64,
    pub web_push_subscriptions: u64,
    pub fcm_token_count: usize,
    pub blocked_user_pairs: u64,
    pub oc_secret_key_initialized: bool,
    pub cycles_balance_check_queue_len: u32,
    pub bots: Vec<BotMetrics>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
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
}

#[derive(Serialize, Debug)]
pub struct BotMetrics {
    pub user_id: UserId,
    pub name: String,
    pub commands: Vec<String>,
}
