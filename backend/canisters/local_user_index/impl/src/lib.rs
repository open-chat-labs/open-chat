use crate::model::btc_miami_payments_queue::BtcMiamiPaymentsQueue;
use crate::model::referral_codes::{ReferralCodes, ReferralTypeMetrics};
use crate::timer_job_types::TimerJob;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use local_user_index_canister::GlobalUser;
use model::global_user_map::GlobalUserMap;
use model::local_user_map::LocalUserMap;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use types::{
    CanisterId, CanisterWasm, ChannelLatestMessageIndex, ChatId, CommunityCanisterChannelSummary,
    CommunityCanisterCommunitySummary, CommunityId, Cycles, MessageContent, ReferralType, TimestampMillis, Timestamped, UserId,
    Version,
};
use user_canister::Event as UserEvent;
use user_index_canister::Event as UserIndexEvent;
use utils::canister;
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::canister_event_sync_queue::CanisterEventSyncQueue;
use utils::consts::CYCLES_REQUIRED_FOR_UPGRADE;
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod timer_job_types;
mod updates;

const USER_CANISTER_INITIAL_CYCLES_BALANCE: Cycles = CYCLES_REQUIRED_FOR_UPGRADE + USER_CANISTER_TOP_UP_AMOUNT; // 0.18T cycles
const USER_CANISTER_TOP_UP_AMOUNT: Cycles = 100_000_000_000; // 0.1T cycles

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
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

    pub fn calling_user(&self) -> GlobalUser {
        let caller = self.env.caller();
        self.data.global_users.get(&caller).unwrap()
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

    pub fn push_event_to_user(&mut self, user_id: UserId, event: UserEvent) {
        self.data.user_event_sync_queue.push(user_id.into(), event);
        jobs::sync_events_to_user_canisters::start_job_if_required(self);
    }

    pub fn push_event_to_user_index(&mut self, event: UserIndexEvent) {
        self.data
            .user_index_event_sync_queue
            .push(self.data.user_index_canister_id, event);
        jobs::sync_events_to_user_index_canister::start_job_if_required(self);
    }

    pub fn push_oc_bot_message_to_user(&mut self, user_id: UserId, message: MessageContent) {
        if self.data.local_users.get(&user_id).is_some() {
            self.push_event_to_user(user_id, UserEvent::OpenChatBotMessage(Box::new(message)));
        } else {
            self.push_event_to_user_index(UserIndexEvent::OpenChatBotMessage(Box::new(
                user_index_canister::OpenChatBotMessage { user_id, message },
            )));
        }
    }

    pub fn notify_user_joined_community(&mut self, user_id: UserId, community: &CommunityCanisterCommunitySummary) {
        let channels = community
            .channels
            .iter()
            .map(|c| ChannelLatestMessageIndex {
                channel_id: c.channel_id,
                latest_message_index: c.latest_message.as_ref().map(|m| m.event.message_index),
            })
            .collect();

        self.notify_user_joined_community_or_channel(user_id, community.community_id, channels);
    }

    pub fn notify_user_joined_channel(
        &mut self,
        user_id: UserId,
        community_id: CommunityId,
        channel: &CommunityCanisterChannelSummary,
    ) {
        self.notify_user_joined_community_or_channel(
            user_id,
            community_id,
            vec![ChannelLatestMessageIndex {
                channel_id: channel.channel_id,
                latest_message_index: channel.latest_message.as_ref().map(|m| m.event.message_index),
            }],
        );
    }

    fn notify_user_joined_community_or_channel(
        &mut self,
        user_id: UserId,
        community_id: CommunityId,
        channels: Vec<ChannelLatestMessageIndex>,
    ) {
        if self.data.local_users.get(&user_id).is_some() {
            self.push_event_to_user(
                user_id,
                UserEvent::UserJoinedCommunityOrChannel(Box::new(user_canister::UserJoinedCommunityOrChannel {
                    community_id,
                    channels,
                })),
            );
        } else {
            self.push_event_to_user_index(UserIndexEvent::UserJoinedCommunityOrChannel(Box::new(
                user_index_canister::UserJoinedCommunityOrChannel {
                    user_id,
                    community_id,
                    channels,
                },
            )));
        }
    }

    pub fn metrics(&self) -> Metrics {
        let canister_upgrades_metrics = self.data.canisters_requiring_upgrade.metrics();
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            total_cycles_spent_on_canisters: self.data.total_cycles_spent_on_canisters,
            canisters_in_pool: self.data.canister_pool.len() as u16,
            local_user_count: self.data.local_users.len() as u64,
            global_user_count: self.data.global_users.len() as u64,
            canister_upgrades_completed: canister_upgrades_metrics.completed,
            canister_upgrades_failed: canister_upgrades_metrics.failed,
            canister_upgrades_pending: canister_upgrades_metrics.pending as u64,
            canister_upgrades_in_progress: canister_upgrades_metrics.in_progress as u64,
            user_wasm_version: self.data.user_canister_wasm_for_new_canisters.version,
            max_concurrent_canister_upgrades: self.data.max_concurrent_canister_upgrades,
            user_upgrade_concurrency: self.data.user_upgrade_concurrency,
            user_events_queue_length: self.data.user_event_sync_queue.len(),
            referral_codes: self.data.referral_codes.metrics(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                notifications: self.data.notifications_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub local_users: LocalUserMap,
    pub global_users: GlobalUserMap,
    pub user_canister_wasm_for_new_canisters: CanisterWasm,
    pub user_canister_wasm_for_upgrades: CanisterWasm,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub canister_pool: canister::Pool,
    pub total_cycles_spent_on_canisters: Cycles,
    pub user_event_sync_queue: CanisterEventSyncQueue<UserEvent>,
    pub user_index_event_sync_queue: CanisterEventSyncQueue<UserIndexEvent>,
    pub test_mode: bool,
    pub max_concurrent_canister_upgrades: u32,
    pub user_upgrade_concurrency: u32,
    pub platform_moderators_group: Option<ChatId>,
    pub referral_codes: ReferralCodes,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub btc_miami_payments_queue: BtcMiamiPaymentsQueue,
}

#[derive(Serialize, Deserialize)]
pub struct FailedMessageUsers {
    pub sender: UserId,
    pub recipient: UserId,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        user_canister_wasm: CanisterWasm,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        internet_identity_canister_id: CanisterId,
        canister_pool_target_size: u16,
        test_mode: bool,
    ) -> Self {
        Data {
            local_users: LocalUserMap::default(),
            global_users: GlobalUserMap::default(),
            user_canister_wasm_for_new_canisters: user_canister_wasm.clone(),
            user_canister_wasm_for_upgrades: user_canister_wasm,
            user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
            cycles_dispenser_canister_id,
            internet_identity_canister_id,
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            canister_pool: canister::Pool::new(canister_pool_target_size),
            total_cycles_spent_on_canisters: 0,
            user_event_sync_queue: CanisterEventSyncQueue::default(),
            user_index_event_sync_queue: CanisterEventSyncQueue::default(),
            test_mode,
            max_concurrent_canister_upgrades: 10,
            user_upgrade_concurrency: 10,
            platform_moderators_group: None,
            referral_codes: ReferralCodes::default(),
            timer_jobs: TimerJobs::default(),
            btc_miami_payments_queue: BtcMiamiPaymentsQueue::default(),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub total_cycles_spent_on_canisters: Cycles,
    pub local_user_count: u64,
    pub global_user_count: u64,
    pub canisters_in_pool: u16,
    pub canister_upgrades_completed: u64,
    pub canister_upgrades_failed: Vec<FailedUpgradeCount>,
    pub canister_upgrades_pending: u64,
    pub canister_upgrades_in_progress: u64,
    pub user_wasm_version: Version,
    pub max_concurrent_canister_upgrades: u32,
    pub user_upgrade_concurrency: u32,
    pub user_events_queue_length: usize,
    pub referral_codes: HashMap<ReferralType, ReferralTypeMetrics>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications: CanisterId,
    pub cycles_dispenser: CanisterId,
}
