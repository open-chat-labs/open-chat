use crate::model::communities::Communities;
use crate::model::community::Community;
use crate::model::direct_chats::DirectChats;
use crate::model::group_chat::GroupChat;
use crate::model::group_chats::GroupChats;
use crate::model::hot_group_exclusions::HotGroupExclusions;
use crate::model::p2p_swaps::P2PSwaps;
use crate::model::pin_number::PinNumber;
use crate::model::token_swaps::TokenSwaps;
use crate::model::user_canister_event_batch::UserCanisterEventBatch;
use crate::timer_job_types::{RemoveExpiredEventsJob, TimerJob};
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use constants::{DAY_IN_MS, MINUTE_IN_MS, OPENCHAT_BOT_USER_ID};
use event_store_producer::{EventStoreClient, EventStoreClientBuilder, EventStoreClientInfo};
use event_store_producer_cdk_runtime::CdkRuntime;
use fire_and_forget_handler::FireAndForgetHandler;
use model::chit::ChitEarnedEvents;
use model::contacts::Contacts;
use model::favourite_chats::FavouriteChats;
use model::message_activity_events::MessageActivityEvents;
use model::referrals::Referrals;
use model::streak::Streak;
use notifications_canister::c2c_push_notification;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use std::cell::RefCell;
use std::collections::HashSet;
use std::ops::Deref;
use std::time::Duration;
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    Achievement, BuildVersion, CanisterId, Chat, ChatId, ChatMetrics, ChitEarned, ChitEarnedReason, CommunityId,
    Cryptocurrency, Cycles, Document, Milliseconds, Notification, TimestampMillis, Timestamped, UniquePersonProof, UserId,
};
use user_canister::{MessageActivityEvent, NamedAccount, UserCanisterEvent, WalletConfig};
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;
use utils::time::{today, tomorrow};

mod crypto;
mod governance_clients;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod openchat_bot;
mod queries;
mod regular_jobs;
mod timer_job_types;
mod token_swaps;
mod updates;

pub const BASIC_GROUP_CREATION_LIMIT: u32 = 5;
pub const PREMIUM_GROUP_CREATION_LIMIT: u32 = 40;
pub const COMMUNITY_CREATION_LIMIT: u32 = 10;
const SIX_MONTHS: Milliseconds = 183 * DAY_IN_MS;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
    pub regular_jobs: RegularJobs<Data>,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data, regular_jobs: RegularJobs<Data>) -> RuntimeState {
        RuntimeState { env, data, regular_jobs }
    }

    pub fn is_caller_owner(&self) -> bool {
        self.env.caller() == self.data.owner
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_local_user_index(&self) -> bool {
        self.env.caller() == self.data.local_user_index_canister_id
    }

    pub fn is_caller_group_index(&self) -> bool {
        self.env.caller() == self.data.group_index_canister_id
    }

    pub fn is_caller_escrow_canister(&self) -> bool {
        self.env.caller() == self.data.escrow_canister_id
    }

    pub fn is_caller_known_group_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.group_chats.exists(&caller.into())
    }

    pub fn is_caller_known_community_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.communities.exists(&caller.into())
    }

    pub fn is_caller_video_call_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data.video_call_operators.iter().any(|o| *o == caller)
    }

    pub fn push_notification(&mut self, recipient: UserId, notification: Notification) {
        let args = c2c_push_notification::Args {
            recipients: vec![recipient],
            authorizer: Some(self.data.local_user_index_canister_id),
            notification_bytes: ByteBuf::from(candid::encode_one(notification).unwrap()),
        };
        ic_cdk::spawn(push_notification_inner(self.data.notifications_canister_id, args));

        async fn push_notification_inner(canister_id: CanisterId, args: c2c_push_notification::Args) {
            let _ = notifications_canister_c2c_client::c2c_push_notification(canister_id, &args).await;
        }
    }

    pub fn run_event_expiry_job(&mut self) {
        let now = self.env.now();
        let mut next_event_expiry = None;
        for chat in self.data.direct_chats.iter_mut() {
            chat.events.remove_expired_events(now);
            if let Some(expiry) = chat.events.next_event_expiry() {
                if next_event_expiry.map_or(true, |current| expiry < current) {
                    next_event_expiry = Some(expiry);
                }
            }
        }

        self.data.next_event_expiry = next_event_expiry;
        if let Some(expiry) = self.data.next_event_expiry {
            self.data
                .timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    pub fn push_user_canister_event(&mut self, canister_id: CanisterId, event: UserCanisterEvent) {
        if canister_id != OPENCHAT_BOT_USER_ID.into() && canister_id != self.env.canister_id() {
            self.data.user_canister_events_queue.push(canister_id.into(), event);
        }
    }

    pub fn is_empty_and_dormant(&self) -> bool {
        if self.data.direct_chats.len() <= 1
            && self.data.group_chats.len() == 0
            && self.data.communities.len() == 0
            && self.data.diamond_membership_expires_at.is_none()
            && self.data.unique_person_proof.is_none()
            && self.data.group_chats.removed_len() == 0
            && self.data.communities.removed_len() == 0
        {
            let now = self.env.now();
            if self.data.user_created + SIX_MONTHS < now && self.data.chit_events.last_updated() + SIX_MONTHS < now {
                return true;
            }
        }
        false
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            direct_chats: self.data.direct_chats.len() as u32,
            group_chats: self.data.group_chats.len() as u32,
            groups_created: self.data.group_chats.groups_created(),
            blocked_users: self.data.blocked_users.len() as u32,
            created: self.data.user_created,
            direct_chat_metrics: self.data.direct_chats.metrics().hydrate(),
            event_store_client_info: self.data.event_store_client.info(),
            video_call_operators: self.data.video_call_operators.clone(),
            timer_jobs: self.data.timer_jobs.len() as u32,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                notifications: self.data.notifications_canister_id,
                bot_api_gateway: self.data.bot_api_gateway_canister_id,
                proposals_bot: self.data.proposals_bot_canister_id,
                escrow: self.data.escrow_canister_id,
                icp_ledger: Cryptocurrency::InternetComputer.ledger_canister_id().unwrap(),
            },
            chit_balance: self.data.chit_events.balance_for_month_by_timestamp(now),
            streak: self.data.streak.days(now),
            streak_ends: self.data.streak.ends(),
            next_daily_claim: if self.data.streak.can_claim(now) { today(now) } else { tomorrow(now) },
            achievements: self.data.achievements.iter().cloned().collect(),
            unique_person_proof: self.data.unique_person_proof.is_some(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub communities: Communities,
    pub favourite_chats: FavouriteChats,
    pub blocked_users: Timestamped<HashSet<UserId>>,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub bot_api_gateway_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub avatar: Timestamped<Option<Document>>,
    pub test_mode: bool,
    pub is_platform_moderator: bool,
    pub hot_group_exclusions: HotGroupExclusions,
    pub username: Timestamped<String>,
    pub display_name: Timestamped<Option<String>>,
    pub bio: Timestamped<String>,
    pub storage_limit: u64,
    pub phone_is_verified: bool,
    pub user_created: TimestampMillis,
    pub suspended: Timestamped<bool>,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub contacts: Contacts,
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub saved_crypto_accounts: Vec<NamedAccount>,
    pub next_event_expiry: Option<TimestampMillis>,
    pub token_swaps: TokenSwaps,
    pub p2p_swaps: P2PSwaps,
    pub user_canister_events_queue: GroupedTimerJobQueue<UserCanisterEventBatch>,
    pub video_call_operators: Vec<Principal>,
    pub event_store_client: EventStoreClient<CdkRuntime>,
    pub pin_number: PinNumber,
    pub btc_address: Option<String>,
    pub chit_events: ChitEarnedEvents,
    pub streak: Streak,
    pub achievements: HashSet<Achievement>,
    pub external_achievements: HashSet<String>,
    pub achievements_last_seen: TimestampMillis,
    pub unique_person_proof: Option<UniquePersonProof>,
    pub wallet_config: Timestamped<WalletConfig>,
    pub rng_seed: [u8; 32],
    pub referred_by: Option<UserId>,
    pub referrals: Referrals,
    pub message_activity_events: MessageActivityEvents,
    pub stable_memory_keys_to_garbage_collect: Vec<Vec<u8>>,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        bot_api_gateway_canister_id: CanisterId,
        proposals_bot_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        username: String,
        test_mode: bool,
        referred_by: Option<UserId>,
        now: TimestampMillis,
    ) -> Data {
        Data {
            owner,
            direct_chats: DirectChats::default(),
            group_chats: GroupChats::default(),
            communities: Communities::default(),
            favourite_chats: FavouriteChats::default(),
            blocked_users: Timestamped::default(),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            notifications_canister_id,
            bot_api_gateway_canister_id,
            proposals_bot_canister_id,
            escrow_canister_id,
            avatar: Timestamped::default(),
            test_mode,
            is_platform_moderator: false,
            hot_group_exclusions: HotGroupExclusions::default(),
            username: Timestamped::new(username, now),
            display_name: Timestamped::default(),
            bio: Timestamped::new("".to_string(), now),
            storage_limit: 0,
            phone_is_verified: false,
            user_created: now,
            suspended: Timestamped::default(),
            timer_jobs: TimerJobs::default(),
            contacts: Contacts::default(),
            diamond_membership_expires_at: None,
            fire_and_forget_handler: FireAndForgetHandler::default(),
            saved_crypto_accounts: Vec::new(),
            next_event_expiry: None,
            token_swaps: TokenSwaps::default(),
            p2p_swaps: P2PSwaps::default(),
            user_canister_events_queue: GroupedTimerJobQueue::new(10, false),
            video_call_operators,
            event_store_client: EventStoreClientBuilder::new(local_user_index_canister_id, CdkRuntime::default())
                .with_flush_delay(Duration::from_millis(5 * MINUTE_IN_MS))
                .build(),
            pin_number: PinNumber::default(),
            btc_address: None,
            chit_events: ChitEarnedEvents::default(),
            streak: Streak::default(),
            achievements: HashSet::new(),
            external_achievements: HashSet::new(),
            achievements_last_seen: 0,
            unique_person_proof: None,
            rng_seed: [0; 32],
            wallet_config: Timestamped::default(),
            referred_by,
            referrals: Referrals::default(),
            message_activity_events: MessageActivityEvents::default(),
            stable_memory_keys_to_garbage_collect: Vec::new(),
        }
    }

    pub fn block_user(&mut self, user_id: UserId, now: TimestampMillis) {
        if self.blocked_users.value.insert(user_id) {
            self.blocked_users.timestamp = now;
        }
    }

    pub fn unblock_user(&mut self, user_id: &UserId, now: TimestampMillis) {
        if self.blocked_users.value.remove(user_id) {
            self.blocked_users.timestamp = now;
        }
    }

    pub fn is_diamond_member(&self, now: TimestampMillis) -> bool {
        self.diamond_membership_expires_at.map_or(false, |ts| now < ts)
    }

    pub fn remove_group(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        self.favourite_chats.remove(&Chat::Group(chat_id), now);
        self.hot_group_exclusions.add(chat_id, None, now);
        self.group_chats.remove(chat_id, now)
    }

    pub fn remove_community(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        let community = self.communities.remove(community_id, now)?;
        for channel_id in community.channels.keys() {
            self.favourite_chats.remove(&Chat::Channel(community_id, *channel_id), now);
        }
        Some(community)
    }

    pub fn handle_event_expiry(&mut self, expiry: TimestampMillis, now: TimestampMillis) {
        if self.next_event_expiry.map_or(true, |ex| expiry < ex) {
            self.next_event_expiry = Some(expiry);

            let timer_jobs = &mut self.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
            timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    pub fn award_achievements_and_notify(&mut self, achievements: Vec<Achievement>, now: TimestampMillis) {
        let mut awarded = false;

        for achievement in achievements {
            awarded |= self.award_achievement(achievement, now);
        }

        if awarded {
            self.notify_user_index_of_chit(now);
        }
    }

    pub fn award_achievement_and_notify(&mut self, achievement: Achievement, now: TimestampMillis) {
        if self.award_achievement(achievement, now) {
            self.notify_user_index_of_chit(now);
        }
    }

    pub fn award_achievement(&mut self, achievement: Achievement, now: TimestampMillis) -> bool {
        if self.achievements.insert(achievement) {
            let amount = achievement.chit_reward() as i32;
            self.chit_events.push(ChitEarned {
                amount,
                timestamp: now,
                reason: ChitEarnedReason::Achievement(achievement),
            });
            true
        } else {
            false
        }
    }

    pub fn award_external_achievement(&mut self, name: String, chit_reward: u32, now: TimestampMillis) -> bool {
        if self.external_achievements.insert(name.clone()) {
            self.chit_events.push(ChitEarned {
                amount: chit_reward as i32,
                timestamp: now,
                reason: ChitEarnedReason::ExternalAchievement(name),
            });

            self.notify_user_index_of_chit(now);

            true
        } else {
            false
        }
    }

    pub fn notify_user_index_of_chit(&self, now: TimestampMillis) {
        let args = user_index_canister::c2c_notify_chit::Args {
            timestamp: now,
            chit_balance: self.chit_events.balance_for_month_by_timestamp(now),
            streak: self.streak.days(now),
            streak_ends: self.streak.ends(),
        };

        self.fire_and_forget_handler.send(
            self.user_index_canister_id,
            "c2c_notify_chit_msgpack".to_string(),
            msgpack::serialize_then_unwrap(args),
        );
    }

    pub fn push_message_activity(&mut self, event: MessageActivityEvent, now: TimestampMillis) {
        if event.user_id.map_or(true, |user_id| !self.blocked_users.contains(&user_id)) {
            self.message_activity_events.push(event, now);
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub direct_chats: u32,
    pub group_chats: u32,
    pub groups_created: u32,
    pub blocked_users: u32,
    pub created: TimestampMillis,
    pub direct_chat_metrics: ChatMetrics,
    pub event_store_client_info: EventStoreClientInfo,
    pub video_call_operators: Vec<Principal>,
    pub timer_jobs: u32,
    pub canister_ids: CanisterIds,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
    pub next_daily_claim: TimestampMillis,
    pub achievements: Vec<Achievement>,
    pub unique_person_proof: bool,
}

fn run_regular_jobs() {
    mutate_state(|state| state.regular_jobs.run(state.env.deref(), &mut state.data));
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub notifications: CanisterId,
    pub bot_api_gateway: CanisterId,
    pub proposals_bot: CanisterId,
    pub escrow: CanisterId,
    pub icp_ledger: CanisterId,
}
