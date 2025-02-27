use crate::model::referral_codes::{ReferralCodes, ReferralTypeMetrics};
use crate::model::user_event_batch::UserEventBatch;
use crate::model::user_index_event_batch::UserIndexEventBatch;
use candid::Principal;
use canister_state_macros::canister_state;
use constants::{CYCLES_REQUIRED_FOR_UPGRADE, MINUTE_IN_MS};
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use event_store_utils::EventDeduper;
use fire_and_forget_handler::FireAndForgetHandler;
use jwt::{verify_and_decode, Claims};
use local_user_index_canister::{ChildCanisterType, GlobalUser};
use model::bots_map::BotsMap;
use model::global_user_map::GlobalUserMap;
use model::local_user_map::LocalUserMap;
use p256_key_pair::P256KeyPair;
use proof_of_unique_personhood::verify_proof_of_unique_personhood;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, VecDeque};
use std::time::Duration;
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    BuildVersion, CanisterId, ChannelLatestMessageIndex, ChatId, ChildCanisterWasms, CommunityCanisterChannelSummary,
    CommunityCanisterCommunitySummary, CommunityId, Cycles, DiamondMembershipDetails, IdempotentEnvelope, MessageContent,
    ReferralType, TimestampMillis, Timestamped, User, UserId, VerifiedCredentialGateArgs,
};
use user_canister::LocalUserIndexEvent as UserEvent;
use user_index_canister::LocalUserIndexEvent as UserIndexEvent;
use utils::canister;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;
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

const USER_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + USER_CANISTER_TOP_UP_AMOUNT; // 0.18T cycles
const USER_CANISTER_TOP_UP_AMOUNT: Cycles = 200_000_000_000; // 0.2T cycles

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

    pub fn is_caller_user_index_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_index_canister_id == caller
    }

    pub fn is_caller_local_user_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_users.get(&caller.into()).is_some()
    }

    pub fn is_caller_notifications_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.notifications_canister_id == caller
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

    pub fn push_event_to_user_index(&mut self, event: UserIndexEvent, now: TimestampMillis) {
        self.data.user_index_event_sync_queue.push(
            self.data.user_index_canister_id,
            IdempotentEnvelope {
                created_at: now,
                idempotency_id: self.env.rng().next_u64(),
                value: event,
            },
        );
    }

    pub fn push_oc_bot_message_to_user(
        &mut self,
        user_id: UserId,
        content: MessageContent,
        _mentioned: Vec<User>,
        now: TimestampMillis,
    ) {
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
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        let event_store_client_info = self.data.event_store_client.info();
        let event_relay_canister_id = event_store_client_info.event_store_canister_id;

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_user_count: self.data.local_users.len() as u64,
            global_user_count: self.data.global_users.len() as u64,
            bot_user_count: self.data.global_users.legacy_bots().len() as u64,
            oc_controlled_bots: self.data.global_users.oc_controlled_bots().iter().copied().collect(),
            platform_moderators: self.data.global_users.platform_moderators().len() as u32,
            platform_operators: self.data.global_users.platform_operators().len() as u32,
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            user_wasm_version: self.data.child_canister_wasms.get(ChildCanisterType::User).wasm.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            user_upgrade_concurrency: self.data.user_upgrade_concurrency,
            user_events_queue_length: self.data.user_event_sync_queue.len(),
            users_to_delete_queue_length: self.data.users_to_delete_queue.len(),
            referral_codes: self.data.referral_codes.metrics(now),
            event_store_client_info,
            user_versions: self
                .data
                .local_users
                .iter()
                .map(|u| u.1.wasm_version.to_string())
                .count_per_value(),
            oc_secret_key_initialized: self.data.oc_key_pair.is_initialised(),
            canister_upgrades_failed: canister_upgrades_metrics.failed,
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
            recent_upgrades: canister_upgrades_metrics.recently_competed,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                identity: self.data.identity_canister_id,
                notifications: self.data.notifications_canister_id,
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
    pub global_users: GlobalUserMap,
    pub bots: BotsMap,
    pub child_canister_wasms: ChildCanisterWasms<ChildCanisterType>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub website_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub user_event_sync_queue: GroupedTimerJobQueue<UserEventBatch>,
    pub user_index_event_sync_queue: GroupedTimerJobQueue<UserIndexEventBatch>,
    pub test_mode: bool,
    pub max_concurrent_canister_upgrades: u32,
    pub user_upgrade_concurrency: u32,
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
    pub cycles_balance_check_queue: VecDeque<UserId>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    #[serde(default)]
    pub idempotency_checker: IdempotencyChecker,
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
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        event_relay_canister_id: CanisterId,
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
            global_users: GlobalUserMap::default(),
            child_canister_wasms: ChildCanisterWasms::default(),
            user_index_canister_id,
            group_index_canister_id,
            identity_canister_id,
            notifications_canister_id,
            proposals_bot_canister_id,
            cycles_dispenser_canister_id,
            escrow_canister_id,
            internet_identity_canister_id,
            website_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            user_event_sync_queue: GroupedTimerJobQueue::new(10, false),
            user_index_event_sync_queue: GroupedTimerJobQueue::new(1, true),
            test_mode,
            max_concurrent_canister_upgrades: 10,
            user_upgrade_concurrency: 10,
            platform_moderators_group: None,
            referral_codes: ReferralCodes::default(),
            rng_seed: [0; 32],
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
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub local_user_count: u64,
    pub global_user_count: u64,
    pub bot_user_count: u64,
    pub oc_controlled_bots: Vec<UserId>,
    pub platform_moderators: u32,
    pub platform_operators: u32,
    pub canisters_in_pool: u16,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub user_wasm_version: BuildVersion,
    pub max_concurrent_canister_upgrades: u32,
    pub user_upgrade_concurrency: u32,
    pub user_events_queue_length: usize,
    pub users_to_delete_queue_length: usize,
    pub referral_codes: HashMap<ReferralType, ReferralTypeMetrics>,
    pub event_store_client_info: EventStoreClientInfo,
    pub user_versions: BTreeMap<String, u32>,
    pub oc_secret_key_initialized: bool,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub cycles_balance_check_queue_len: u32,
    pub bots: Vec<BotMetrics>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub recent_upgrades: Vec<CanisterId>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub identity: CanisterId,
    pub notifications: CanisterId,
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
