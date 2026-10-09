use crate::model::local_user_index_event_batch::LocalUserIndexEventBatch;
use crate::model::user_canister_event_batch::UserCanisterEventBatch;
use crate::timer_job_types::{
    ClaimOrResetStreakInsuranceJob, DeleteFileReferencesJob, JobOnMigration, RemoveExpiredEventsJob, TimerJob,
};
use canister_state_macros::canister_state;
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::EventPusher;
use constants::{HOUR_IN_MS, ICP_LEDGER_CANISTER_ID, OPENCHAT_BOT_USER_ID};
use event_store_types::{Event, EventBuilder};
use fire_and_forget_handler::FireAndForgetHandler;
use ic_principal::Principal;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use rand::prelude::StdRng;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use std::ops::Deref;
use timer_job_queues::{BatchedTimerJobQueue, GroupedTimerJobQueue};
use types::{
    Achievement, BotNotification, BuildVersion, CanisterId, ChatId, ChatMetrics, ChitEvent, ChitEventType, CommunityId, Cycles,
    DirectChatUserNotificationPayload, FrozenUserInfo, Hash, IdempotentEnvelope, MessageId, MessageIndex, Notification,
    NotifyChit, OCResult, TimestampMillis, Timestamped, UserCanisterStreakInsuranceClaim, UserCanisterStreakInsurancePayment,
    UserId, UserNotification,
};
use user_canister::UserCanisterEvent;
use user_core::migration::MigratingUser;
use user_core::{Community, GroupChat, User};
use utils::async_work::{AsyncWorkGuard, async_work_in_progress};
use utils::canister::trap_if_frozen;
use utils::env::Environment;
use utils::idempotency_checker::IdempotencyChecker;
use utils::migrated_user_ids::MigratedUserIds;
use utils::regular_jobs::RegularJobs;

mod crypto;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod openchat_bot;
mod queries;
mod regular_jobs;
mod timer_job_types;
mod updates;

// The most exported in a single page when the user is being migrated to a MultiUser canister,
// leaving room within the 2MB limit on a reply
const PAGE_SIZE: u32 = 19 * 102 * 1024; // Roughly 1.9MB (1.9 * 1024 * 1024)

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

    // The regular jobs are skipped while the canister is frozen
    pub fn run_regular_jobs(&mut self) {
        if !self.data.is_frozen() {
            self.regular_jobs.run(self.env.deref(), &mut self.data);
        }
    }

    pub fn is_caller_owner(&self) -> bool {
        self.env.caller() == self.data.user.principal
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_multi_user_canister_migrating_to(&self) -> bool {
        self.data
            .migration
            .as_ref()
            .is_some_and(|m| m.multi_user_canister_id == self.env.caller())
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
        self.data.user.group_chats.exists(&caller.into())
    }

    pub fn is_caller_known_community_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.user.communities.exists(&caller.into())
    }

    pub fn is_caller_video_call_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data.video_call_operators.contains(&caller)
    }

    pub fn push_notification(
        &mut self,
        sender: Option<UserId>,
        recipient: UserId,
        notification: DirectChatUserNotificationPayload,
    ) {
        self.data.local_user_index_event_sync_queue.push(IdempotentEnvelope {
            created_at: self.env.now(),
            idempotency_id: self.env.rng().next_u64(),
            value: local_user_index_canister::UserEvent::Notification(Box::new(Notification::User(UserNotification {
                sender,
                recipients: vec![recipient],
                notification,
            }))),
        })
    }

    pub fn run_event_expiry_job(&mut self) {
        let now = self.env.now();
        let mut files_to_delete = Vec::new();
        for chat_id in self.data.user.direct_chats.chats_with_events_expiring_by(now) {
            let Some(mut chat) = self.data.user.direct_chats.get_mut(&chat_id) else {
                continue;
            };
            let result = chat.remove_expired_events(&self.data.migrated_user_ids, now);
            files_to_delete.extend(result.files);
            // Threads aren't currently enabled for direct chats, but if a thread's root message
            // expires then its entries in stable memory must be garbage collected
            for thread in result.threads {
                self.data
                    .stable_memory_keys_to_garbage_collect
                    .extend(chat.events().thread_stable_memory_key_prefixes(thread.root_message_index));
            }
        }

        jobs::garbage_collect_stable_memory::start_job_if_required(&self.data);

        if !files_to_delete.is_empty() {
            let delete_files_job = DeleteFileReferencesJob { files: files_to_delete };
            delete_files_job.execute();
        }
        self.data.user.next_event_expiry = self.data.user.direct_chats.next_event_expiry();
        if let Some(expiry) = self.data.user.next_event_expiry {
            self.data
                .timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    // Cancels the job to mark the P2P swap offered in the message in the direct chat with `them` as
    // expired, once the swap has ended. The job names the chat by the other user's id when it was
    // queued, which they may since have been migrated from.
    pub fn cancel_mark_p2p_swap_expired_job(
        &mut self,
        them: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) {
        let migrated_user_ids = &self.data.migrated_user_ids;
        let them = migrated_user_ids.latest(them);
        self.data.timer_jobs.cancel_job(|job| {
            matches!(job, TimerJob::MarkP2PSwapExpired(j)
                if j.message_id == message_id
                    && j.thread_root_message_index == thread_root_message_index
                    && migrated_user_ids.latest(j.chat_id.into()) == them)
        });
    }

    // Queues an event for `recipient`, batched with the others for the canister holding them
    pub fn push_user_canister_event(&mut self, recipient: UserId, event: UserCanisterEvent) {
        if recipient != OPENCHAT_BOT_USER_ID && recipient != self.env.canister_id().into() {
            // Sent to the recipient's latest id if they are known to have been migrated since
            // having `recipient`
            let recipient = self.data.migrated_user_ids.latest(recipient);
            self.data.user_canister_events_by_canister.push(
                recipient.canister_id(),
                IdempotentEnvelope {
                    created_at: self.env.now(),
                    idempotency_id: self.env.rng().next_u64(),
                    value: (recipient, event),
                },
            );
        }
    }

    pub fn mark_streak_insurance_payment(&mut self, payment: UserCanisterStreakInsurancePayment) {
        self.data.user.streak.mark_streak_insurance_payment(payment.clone());
        self.set_up_streak_insurance_timer_job();
        let user_id: UserId = self.env.canister_id().into();
        let events = vec![
            LocalUserIndexEvent::EventStoreEvent(
                EventBuilder::new("user_streak_insurance_payment", payment.timestamp)
                    .with_user(user_id.to_string(), true)
                    .with_source(user_id.to_string(), true)
                    .with_json_payload(&payment)
                    .build(),
            ),
            LocalUserIndexEvent::NotifyStreakInsurancePayment(payment),
        ];
        self.push_local_user_index_canister_events(events, self.env.now());
    }

    pub fn mark_streak_insurance_claim(&mut self, claim: UserCanisterStreakInsuranceClaim) {
        self.data.user.chit_events.push(ChitEvent {
            amount: 0,
            timestamp: claim.timestamp,
            reason: ChitEventType::StreakInsuranceClaim,
        });
        let user_id: UserId = self.env.canister_id().into();
        let new_streak = claim.streak_length;
        let days_remaining = claim.insured_days_remaining;
        let events = vec![
            LocalUserIndexEvent::EventStoreEvent(
                EventBuilder::new("user_streak_insurance_claim", claim.timestamp)
                    .with_user(user_id.to_string(), true)
                    .with_source(user_id.to_string(), true)
                    .with_json_payload(&claim)
                    .build(),
            ),
            LocalUserIndexEvent::NotifyStreakInsuranceClaim(claim),
        ];
        self.push_local_user_index_canister_events(events, self.env.now());
        openchat_bot::send_text_message(
            user_core::openchat_bot::streak_insurance_claimed_text(new_streak, days_remaining),
            Vec::new(),
            false,
            self,
        );
    }

    pub fn set_up_streak_insurance_timer_job(&mut self) {
        if self.data.user.streak.days_insured() > 0 {
            self.data
                .timer_jobs
                .cancel_jobs(|j| matches!(j, TimerJob::ClaimOrResetStreakInsurance(_)));

            self.data.timer_jobs.enqueue_job(
                TimerJob::ClaimOrResetStreakInsurance(ClaimOrResetStreakInsuranceJob),
                self.data.user.streak.ends(),
                self.env.now(),
            );
        }
    }

    pub fn push_bot_notification(&mut self, notification: Option<BotNotification>) {
        if let Some(notification) = notification
            && !notification.recipients.is_empty()
        {
            self.push_local_user_index_canister_event(
                LocalUserIndexEvent::Notification(Box::new(Notification::Bot(notification))),
                self.env.now(),
            );
        }
    }

    pub fn push_local_user_index_canister_event(
        &mut self,
        event: LocalUserIndexEvent<DirectChatUserNotificationPayload>,
        now: TimestampMillis,
    ) {
        self.data.local_user_index_event_sync_queue.push(IdempotentEnvelope {
            created_at: now,
            idempotency_id: self.env.rng().next_u64(),
            value: event,
        });
    }

    pub fn push_local_user_index_canister_events(
        &mut self,
        events: Vec<LocalUserIndexEvent<DirectChatUserNotificationPayload>>,
        now: TimestampMillis,
    ) {
        self.data.local_user_index_event_sync_queue.push_many(
            events
                .into_iter()
                .map(|event| IdempotentEnvelope {
                    created_at: now,
                    idempotency_id: self.env.rng().next_u64(),
                    value: event,
                })
                .collect(),
        );
    }

    pub fn award_achievements_and_notify(&mut self, achievements: Vec<Achievement>, now: TimestampMillis) {
        let mut awarded = false;

        for achievement in achievements {
            awarded |= self.data.user.award_achievement(achievement, now);
        }

        if awarded {
            self.notify_user_index_of_chit(now);
        }
    }

    pub fn award_achievement_and_notify(&mut self, achievement: Achievement, now: TimestampMillis) {
        if self.data.user.award_achievement(achievement, now) {
            self.notify_user_index_of_chit(now);
        }
    }

    pub fn notify_user_index_of_chit(&mut self, now: TimestampMillis) {
        self.push_local_user_index_canister_event(
            LocalUserIndexEvent::NotifyChit(NotifyChit {
                timestamp: now,
                total_chit_earned: self.data.user.chit_events.total_chit_earned(),
                chit_balance: self.data.user.chit_events.balance_for_month_by_timestamp(now),
                chit_balance_v2: self.data.user.chit_events.chit_balance(),
                streak: self.data.user.streak.days(now),
                streak_ends: self.data.user.streak.ends(),
            }),
            now,
        )
    }

    pub fn block_user(&mut self, user_id: UserId, now: TimestampMillis) {
        if self.data.user.blocked_users.block(user_id, now) {
            self.push_local_user_index_canister_event(LocalUserIndexEvent::UserBlocked(user_id), now);
        }
    }

    pub fn unblock_user(&mut self, user_id: UserId, now: TimestampMillis) {
        if self.data.user.blocked_users.unblock(user_id, now) {
            self.push_local_user_index_canister_event(LocalUserIndexEvent::UserUnblocked(user_id), now);
        }
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            direct_chats: self.data.user.direct_chats.len() as u32,
            group_chats: self.data.user.group_chats.len() as u32,
            communities: self.data.user.communities.len() as u32,
            groups_created: self.data.user.group_chats.groups_created(),
            blocked_users: self.data.user.blocked_users.len() as u32,
            created: self.data.user.user_created,
            direct_chat_metrics: self.data.user.direct_chats.metrics().hydrate(),
            video_call_operators: self.data.video_call_operators.clone(),
            timer_jobs: self.data.timer_jobs.len() as u32,
            queued_user_events: self.data.user_canister_events_by_canister.len() as u32,
            queued_local_index_events: self.data.local_user_index_event_sync_queue.len() as u32,
            total_chit_earned: self.data.user.chit_events.total_chit_earned(),
            chit_balance: self.data.user.chit_events.chit_balance(),
            streak: self.data.user.streak.days(now),
            streak_ends: self.data.user.streak.ends(),
            max_streak: self.data.user.streak.max_streak(),
            next_daily_claim: self.data.user.streak.next_claim(),
            achievements: self.data.user.achievements.iter().cloned().collect(),
            unique_person_proof: self.data.user.unique_person_proof.is_some(),
            referred_by: self.data.user.referred_by,
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                identity: self.data.identity_canister_id,
                escrow: self.data.escrow_canister_id,
                icp_ledger: ICP_LEDGER_CANISTER_ID,
            },
        }
    }

    pub fn delete_direct_chat(&mut self, user_id: UserId, block_user: bool, now: TimestampMillis) -> bool {
        let Some(chat) = self.data.user.remove_direct_chat(user_id, now) else {
            return false;
        };

        if block_user {
            self.block_user(user_id, now);
        }

        self.data
            .stable_memory_keys_to_garbage_collect
            .extend(chat.stable_memory_key_prefixes());

        jobs::garbage_collect_stable_memory::start_job_if_required(&self.data);
        true
    }

    // Queues the entries under the prefixes for removal from the stable memory map
    pub fn garbage_collect_stable_memory_keys(&mut self, prefixes: Vec<BaseKeyPrefix>) {
        self.data.stable_memory_keys_to_garbage_collect.extend(prefixes);
        jobs::garbage_collect_stable_memory::start_job_if_required(&self.data);
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    // The user this canister holds
    pub user: User,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub test_mode: bool,
    pub timer_jobs: TimerJobs<TimerJob>,
    pub fire_and_forget_handler: FireAndForgetHandler,
    #[serde(default = "new_user_canister_events_by_canister")]
    pub user_canister_events_by_canister: GroupedTimerJobQueue<UserCanisterEventBatch>,
    pub video_call_operators: Vec<Principal>,
    pub rng_seed: [u8; 32],
    pub stable_memory_keys_to_garbage_collect: Vec<BaseKeyPrefix>,
    pub local_user_index_event_sync_queue: BatchedTimerJobQueue<LocalUserIndexEventBatch>,
    pub idempotency_checker: IdempotencyChecker,
    // The MultiUser canisters the UserIndex has confirmed, which may send events on behalf of any of
    // their users
    #[serde(default)]
    pub known_multi_user_canisters: HashSet<CanisterId>,
    // The latest ids of migrated users, as looked up from the LocalUserIndex whenever a user's id is found to
    // have changed
    #[serde(default)]
    pub migrated_user_ids: MigratedUserIds,
    // Set while the canister's state must not change, during which every update call is rejected.
    // Queries are still served.
    #[serde(default)]
    pub frozen: Option<FrozenUserInfo>,
    // Set when the user starts being migrated to a MultiUser canister. The canister's state must not
    // change from then on, so it is treated as frozen.
    #[serde(default)]
    pub migration: Option<Migration>,
}

#[derive(Serialize, Deserialize)]
pub struct Migration {
    pub multi_user_canister_id: CanisterId,
    pub started: TimestampMillis,
    // The user as they were when the migration started, along with the timer jobs handed over with
    // them, serialized with msgpack as a `MigratingUser`, for the MultiUser canister to pull
    #[serde(with = "serde_bytes")]
    pub user: Vec<u8>,
    // The hash of `user` and `started`, which identifies the migration, and which the MultiUser
    // canister checks once it has pulled all of `user`
    pub user_hash: Hash,
    // The version of the wasm which serialized the user, which may since have been upgraded
    pub wasm_version: BuildVersion,
    // The timer jobs handed over along with the user, each with when it is due, which are scheduled
    // again here if the migration is cancelled
    #[serde(default)]
    pub timer_jobs: Vec<(TimerJob, TimestampMillis)>,
}

impl Data {
    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some() || self.migration.is_some()
    }

    pub fn is_migrating(&self) -> bool {
        self.migration.is_some()
    }

    // Starts migrating the user to the given MultiUser canister, if the canister is ready, storing
    // the user serialized for the MultiUser canister to pull. From then on the canister is frozen,
    // and its timer jobs are cancelled. The MultiUser canister schedules them again, either from the
    // user's state or from those handed over along with the user. A repeated call for the same
    // MultiUser canister returns the same migration again.
    pub fn try_start_migration(&mut self, multi_user_canister_id: CanisterId, now: TimestampMillis) -> OCResult<&Migration> {
        match &self.migration {
            Some(migration) if migration.multi_user_canister_id == multi_user_canister_id => {}
            Some(_) => return Err(OCErrorCode::AlreadyInProgress.into()),
            None => {
                if let Some(reason) = self.reason_not_ready_for_migration(now) {
                    return Err(OCErrorCode::NotReadyForMigration.with_message(reason));
                }

                let timer_jobs: Vec<(TimerJob, TimestampMillis)> = (&self.timer_jobs).into();
                self.timer_jobs.cancel_jobs(|_| true);
                let (timer_jobs, handed_over): (Vec<_>, Vec<_>) = timer_jobs
                    .into_iter()
                    .filter_map(|(job, due)| match job.on_migration() {
                        JobOnMigration::HandedOver(mut migrated) => {
                            // Other users the job names may have been migrated since it was scheduled,
                            // which this canister knows of but the MultiUser canister may not
                            migrated.map_user_ids(|user_id| {
                                self.user.direct_chats.latest_user_id(user_id, &self.migrated_user_ids)
                            });
                            Some(((job, due), (migrated, due)))
                        }
                        JobOnMigration::RebuiltFromState | JobOnMigration::BlocksMigration => None,
                    })
                    .unzip();
                let user = msgpack::serialize_then_unwrap(MigratingUser {
                    user: &self.user,
                    timer_jobs: handed_over,
                });
                self.migration = Some(Migration {
                    multi_user_canister_id,
                    started: now,
                    user_hash: user_canister::migration_hash(&user, now),
                    user,
                    wasm_version: WASM_VERSION.with_borrow(|v| **v),
                    timer_jobs,
                });
            }
        }
        Ok(self.migration.as_ref().unwrap())
    }

    // Cancels the user's migration to the given MultiUser canister, if there is one, unfreezing the
    // canister and scheduling again the timer jobs which were cancelled when the migration started.
    // Returns whether there was one. A migration to another MultiUser canister is left in place.
    pub fn cancel_migration(&mut self, multi_user_canister_id: CanisterId, now: TimestampMillis) -> OCResult<bool> {
        let Some(migration) = self
            .migration
            .take_if(|migration| migration.multi_user_canister_id == multi_user_canister_id)
        else {
            return match self.migration {
                Some(_) => Err(OCErrorCode::AlreadyInProgress.with_message("Migrating to another canister")),
                None => Ok(false),
            };
        };

        for (job, due) in migration.timer_jobs {
            self.timer_jobs.enqueue_job(job, due, now);
        }
        if let Some(expiry) = self.user.next_event_expiry {
            self.timer_jobs
                .enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
        if self.user.streak.days_insured() > 0 {
            self.timer_jobs.enqueue_job(
                TimerJob::ClaimOrResetStreakInsurance(ClaimOrResetStreakInsuranceJob),
                self.user.streak.ends(),
                now,
            );
        }
        Ok(true)
    }

    // The user is migrated along with their entries in the stable memory map, so the canister must
    // have no work outstanding which would change or read them, nor anything else which isn't
    // carried over. Only the timer jobs which the MultiUser canister schedules again may remain.
    fn reason_not_ready_for_migration(&self, now: TimestampMillis) -> Option<&'static str> {
        if self.user.p2p_swaps.any_expiring_after(now.saturating_sub(HOUR_IN_MS)) {
            // The Escrow canister pays out and refunds swaps to this canister's account, so the user
            // isn't migrated until each of their swaps has expired, allowing an hour for its refund
            Some("User has a P2P swap which hasn't yet expired")
        } else if async_work_in_progress() {
            Some("Async work is in progress")
        } else if self.timer_jobs.iter().any(|(_, wrapper)| {
            // A job which has already run leaves an empty entry behind
            wrapper
                .deref()
                .borrow()
                .as_ref()
                .is_some_and(|job| matches!(job.on_migration(), JobOnMigration::BlocksMigration))
        }) {
            Some("Timer jobs are pending")
        } else if !self.user_canister_events_by_canister.is_idle() {
            Some("Events for other users are pending")
        } else if !self.local_user_index_event_sync_queue.is_idle() {
            Some("Events for the LocalUserIndex are pending")
        } else if !self.fire_and_forget_handler.is_empty() {
            Some("Calls to other canisters are pending")
        } else if !self.stable_memory_keys_to_garbage_collect.is_empty() {
            Some("Stable memory is still being garbage collected")
        } else {
            None
        }
    }

    #[expect(clippy::too_many_arguments)]
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        username: String,
        test_mode: bool,
        referred_by: Option<UserId>,
        now: TimestampMillis,
    ) -> Data {
        Data {
            user: User::new(owner, username, referred_by, now),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            identity_canister_id,
            escrow_canister_id,
            test_mode,
            timer_jobs: TimerJobs::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            user_canister_events_by_canister: new_user_canister_events_by_canister(),
            video_call_operators,
            rng_seed: [0; 32],
            stable_memory_keys_to_garbage_collect: Vec::new(),
            local_user_index_event_sync_queue: BatchedTimerJobQueue::new(local_user_index_canister_id, true),
            idempotency_checker: IdempotencyChecker::default(),
            known_multi_user_canisters: HashSet::new(),
            migrated_user_ids: MigratedUserIds::default(),
            frozen: None,
            migration: None,
        }
    }

    pub fn remove_group(&mut self, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        let (group, prefix) = self.user.remove_group(chat_id, now)?;
        self.garbage_collect_now_or_later(prefix);
        Some(group)
    }

    pub fn remove_community(&mut self, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        let (community, prefixes) = self.user.remove_community(community_id, now)?;
        for prefix in prefixes {
            self.garbage_collect_now_or_later(prefix);
        }
        Some(community)
    }

    // A chat only has a small number of entries, so they can be removed immediately. If they can't
    // all be removed within this message, the rest are left for the garbage collection job.
    pub fn garbage_collect_now_or_later(&mut self, prefix: BaseKeyPrefix) {
        if stable_memory_map::garbage_collect(prefix.clone()).is_err() {
            self.stable_memory_keys_to_garbage_collect.push(prefix);
            jobs::garbage_collect_stable_memory::start_job_if_required(self);
        }
    }

    pub fn handle_event_expiry(&mut self, expiry: TimestampMillis, now: TimestampMillis) {
        if self.user.next_event_expiry.is_none_or(|ex| expiry < ex) {
            self.user.next_event_expiry = Some(expiry);

            let timer_jobs = &mut self.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(_)));
            timer_jobs.enqueue_job(TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob), expiry, now);
        }
    }

    pub fn flush_pending_events(&mut self) {
        self.user_canister_events_by_canister.flush();
        self.local_user_index_event_sync_queue.flush();
    }
}

struct UserEventPusher<'a> {
    now: TimestampMillis,
    rng: &'a mut StdRng,
    queue: &'a mut BatchedTimerJobQueue<LocalUserIndexEventBatch>,
}

impl EventPusher for UserEventPusher<'_> {
    fn push(&mut self, event: Event) {
        self.queue.push(IdempotentEnvelope {
            created_at: self.now,
            idempotency_id: self.rng.next_u64(),
            value: local_user_index_canister::UserEvent::EventStoreEvent(event),
        })
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub direct_chats: u32,
    pub group_chats: u32,
    pub communities: u32,
    pub groups_created: u32,
    pub blocked_users: u32,
    pub created: TimestampMillis,
    pub direct_chat_metrics: ChatMetrics,
    pub video_call_operators: Vec<Principal>,
    pub timer_jobs: u32,
    pub queued_user_events: u32,
    pub queued_local_index_events: u32,
    pub total_chit_earned: i32,
    pub chit_balance: i32,
    pub streak: u16,
    pub streak_ends: TimestampMillis,
    pub max_streak: u16,
    pub next_daily_claim: TimestampMillis,
    pub achievements: Vec<Achievement>,
    pub unique_person_proof: bool,
    pub referred_by: Option<UserId>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

// Runs an update call, trapping if the canister is frozen. Endpoints which must keep working while
// frozen use `execute_update_even_if_frozen` instead.
fn execute_update<F: FnOnce(&mut RuntimeState) -> R, R>(f: F) -> R {
    read_state(|state| trap_if_frozen(state.data.is_frozen()));
    execute_update_even_if_frozen(f)
}

fn execute_update_even_if_frozen<F: FnOnce(&mut RuntimeState) -> R, R>(f: F) -> R {
    mutate_state(|state| {
        state.run_regular_jobs();
        let result = f(state);
        state.data.flush_pending_events();
        result
    })
}

async fn execute_update_async<F: FnOnce() -> Fut, Fut: Future<Output = R>, R>(f: F) -> R {
    read_state(|state| trap_if_frozen(state.data.is_frozen()));
    execute_update_async_even_if_frozen(f).await
}

async fn execute_update_async_even_if_frozen<F: FnOnce() -> Fut, Fut: Future<Output = R>, R>(f: F) -> R {
    let _guard = AsyncWorkGuard::new();
    run_regular_jobs();
    let result = f().await;
    flush_pending_events();
    result
}

fn run_regular_jobs() {
    mutate_state(|state| state.run_regular_jobs());
}

fn flush_pending_events() {
    mutate_state(|state| state.data.flush_pending_events());
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub identity: CanisterId,
    pub escrow: CanisterId,
    pub icp_ledger: CanisterId,
}

fn new_user_canister_events_by_canister() -> GroupedTimerJobQueue<UserCanisterEventBatch> {
    GroupedTimerJobQueue::new(10, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_round_trips() {
        let data = Data::new(
            Principal::from_slice(&[1]),
            Principal::from_slice(&[2]),
            Principal::from_slice(&[3]),
            Principal::from_slice(&[4]),
            Principal::from_slice(&[5]),
            Principal::from_slice(&[6]),
            Vec::new(),
            "username".to_string(),
            true,
            None,
            1,
        );

        let bytes = msgpack::serialize_then_unwrap(&data);
        let deserialized: Data = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(deserialized.user.principal, data.user.principal);
        assert_eq!(deserialized.user.username.value, "username");
        assert_eq!(deserialized.user_index_canister_id, data.user_index_canister_id);
    }
}
