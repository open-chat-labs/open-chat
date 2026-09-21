use crate::model::local_user_index_event_batch::LocalUserIndexEventBatch;
use crate::model::user::User;
use crate::model::users::Users;
use crate::timer_job_types::{ClaimOrResetStreakInsuranceJob, RemoveExpiredEventsJob, TimerJob};
use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use direct_chat::DirectChat;
use event_store_types::EventBuilder;
use local_user_index_canister::{UserEvent as LocalUserIndexEvent, UserEventWithUserId};
use oc_error_codes::OCErrorCode;
use rand::Rng;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::cell::RefCell;
use std::collections::BTreeMap;
use timer_job_queues::BatchedTimerJobQueue;
use types::{
    Achievement, BuildVersion, CanisterId, ChatId, ChitEvent, ChitEventType, CommunityId, Cycles,
    DirectChatUserNotificationPayload, IdempotentEnvelope, Notification, NotifyChit, OCResult, TimestampMillis, Timestamped,
    UserCanisterStreakInsuranceClaim, UserCanisterStreakInsurancePayment, UserId, UserNotification,
};
use user_state::{Community, GroupChat};
use utils::env::Environment;

mod crypto;
mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod openchat_bot;
mod queries;
mod timer_job_types;
mod updates;

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

    pub fn is_caller_local_user_index(&self) -> bool {
        self.env.caller() == self.data.local_user_index_canister_id
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_group_index(&self) -> bool {
        self.env.caller() == self.data.group_index_canister_id
    }

    // The index of the user the caller owns, if the caller is one of this canister's users
    pub fn caller_user_index(&self) -> Option<u16> {
        self.data.users.index_by_principal(&self.env.caller())
    }

    // The index of the user the caller owns. Only for endpoints guarded by `caller_is_hosted_user`,
    // which has already checked that there is one, so a caller without a user is a bug rather than
    // a condition to handle.
    pub fn caller_user_index_or_trap(&self) -> u16 {
        self.caller_user_index()
            .unwrap_or_else(|| ic_cdk::trap("Caller is not one of this canister's users"))
    }

    // Runs `f` against the user the caller owns, and their index, for endpoints guarded by
    // `caller_is_hosted_user`
    pub fn with_caller_user<R>(&self, f: impl FnOnce(u16, &User) -> R) -> R {
        let index = self.caller_user_index_or_trap();
        self.data
            .users
            .with_user(index, |user| f(index, user))
            .expect("User not found")
    }

    pub fn with_caller_user_mut<R>(&mut self, f: impl FnOnce(u16, &mut User) -> R) -> R {
        let index = self.caller_user_index_or_trap();
        self.data
            .users
            .with_user_mut(index, |user| f(index, user))
            .expect("User not found")
    }

    // The index within this canister of the user with the given id, provided the caller may act as
    // that user: either the caller owns the user, or the caller is the LocalUserIndex, which acts
    // for any user. The user is not looked up here, so acting on the index can still find no user.
    pub fn authorized_user_index(&self, user_id: UserId) -> OCResult<u16> {
        let index = self.user_index(user_id).ok_or(OCErrorCode::TargetUserNotFound)?;
        if self.is_caller_local_user_index() || self.caller_user_index() == Some(index) {
            Ok(index)
        } else {
            Err(OCErrorCode::InitiatorNotAuthorized.into())
        }
    }

    // The id of the user at the given index within this canister
    pub fn user_id(&self, index: u16) -> UserId {
        UserId::new_indexed(self.env.canister_id(), index)
    }

    // Runs `f` against the user with the given id, within that user's key scope. Fails if the id
    // does not belong to a user in this canister.
    pub fn with_user<R>(&self, user_id: UserId, f: impl FnOnce(&User) -> R) -> OCResult<R> {
        self.user_index(user_id)
            .and_then(|index| self.data.users.with_user(index, f))
            .ok_or_else(|| OCErrorCode::TargetUserNotFound.into())
    }

    // Runs `f` against the direct chat of the user at `user_index` with the user `chat_id` is the
    // id of, within that user's key scope. Fails if there is no such user or chat.
    pub fn with_direct_chat<R>(&self, user_index: u16, chat_id: ChatId, f: impl FnOnce(&DirectChat) -> R) -> OCResult<R> {
        self.data
            .users
            .with_user(user_index, |user| user.direct_chats.get(&chat_id).map(f))
            .ok_or(OCErrorCode::TargetUserNotFound)?
            .ok_or_else(|| OCErrorCode::ChatNotFound.into())
    }

    pub fn with_direct_chat_mut<R>(
        &mut self,
        user_index: u16,
        chat_id: ChatId,
        f: impl FnOnce(&mut DirectChat) -> R,
    ) -> OCResult<R> {
        self.data
            .users
            .with_user_mut(user_index, |user| user.direct_chats.get_mut(&chat_id).map(f))
            .ok_or(OCErrorCode::TargetUserNotFound)?
            .ok_or_else(|| OCErrorCode::ChatNotFound.into())
    }

    // The index within this canister carried by the user id, or None if the id is for a user in a
    // different canister. An id which carries no index maps to index 0, which is never assigned.
    pub fn user_index(&self, user_id: UserId) -> Option<u16> {
        (user_id.canister_id() == self.env.canister_id()).then(|| user_id.index())
    }

    // The index of the user with the given id, if they are one of this canister's users
    pub fn local_user_index(&self, user_id: UserId) -> Option<u16> {
        self.user_index(user_id).filter(|index| self.data.users.contains(*index))
    }

    // Runs `f` against the copy of the chat with `my_user_id` held by `their_user_id`, provided they
    // are a different user in this canister who has the chat and hasn't blocked `my_user_id`. This
    // is how a change a user makes to their copy of a direct chat reaches the other copy when both
    // users are in this canister, in place of the `UserCanisterEvent`s sent between User canisters
    // (which a User canister ignores if its user has blocked the sender).
    pub fn with_their_direct_chat_mut<R>(
        &mut self,
        my_user_id: UserId,
        their_user_id: UserId,
        f: impl FnOnce(&mut DirectChat) -> R,
    ) -> Option<R> {
        if their_user_id == my_user_id {
            return None;
        }
        let their_index = self.local_user_index(their_user_id)?;
        self.data
            .users
            .with_user_mut(their_index, |user| {
                if user.blocked_users.contains(&my_user_id) {
                    None
                } else {
                    user.direct_chats.get_mut(&my_user_id.into()).map(f)
                }
            })
            .flatten()
    }

    // Queues an event from the user at `user_index` for the LocalUserIndex, which it takes as being
    // from that user
    pub fn push_local_user_index_canister_event(
        &mut self,
        user_index: u16,
        event: LocalUserIndexEvent<DirectChatUserNotificationPayload>,
        now: TimestampMillis,
    ) {
        let user_id = self.user_id(user_index);
        self.data.local_user_index_event_sync_queue.push(IdempotentEnvelope {
            created_at: now,
            idempotency_id: self.env.rng().next_u64(),
            value: UserEventWithUserId { user_id, event },
        });
    }

    // Queues a notification for the user at `recipient_index`, as the User canister does for its user
    pub fn push_notification(
        &mut self,
        sender: Option<UserId>,
        recipient_index: u16,
        notification: DirectChatUserNotificationPayload,
        now: TimestampMillis,
    ) {
        let recipient = self.user_id(recipient_index);
        self.push_local_user_index_canister_event(
            recipient_index,
            LocalUserIndexEvent::Notification(Box::new(Notification::User(UserNotification {
                sender,
                recipients: vec![recipient],
                notification,
            }))),
            now,
        );
    }

    // Awards the achievements to the user at `user_index`, telling the LocalUserIndex of their new
    // CHIT balance if any were newly awarded
    pub fn award_achievements_and_notify(
        &mut self,
        user_index: u16,
        achievements: impl IntoIterator<Item = Achievement>,
        now: TimestampMillis,
    ) {
        let awarded = self
            .data
            .users
            .with_user_mut(user_index, |user| {
                achievements.into_iter().fold(false, |awarded, achievement| {
                    user.award_achievement(achievement, now) | awarded
                })
            })
            .unwrap_or_default();

        if awarded {
            self.notify_user_index_of_chit(user_index, now);
        }
    }

    pub fn award_achievement_and_notify(&mut self, user_index: u16, achievement: Achievement, now: TimestampMillis) {
        self.award_achievements_and_notify(user_index, [achievement], now);
    }

    // Tells the LocalUserIndex the CHIT balance and streak of the user at `user_index`, which it
    // passes on to the UserIndex
    pub fn notify_user_index_of_chit(&mut self, user_index: u16, now: TimestampMillis) {
        let Some(notify_chit) = self.data.users.with_user(user_index, |user| NotifyChit {
            timestamp: now,
            total_chit_earned: user.chit_events.total_chit_earned(),
            chit_balance: user.chit_events.balance_for_month_by_timestamp(now),
            chit_balance_v2: user.chit_events.chit_balance(),
            streak: user.streak.days(now),
            streak_ends: user.streak.ends(),
        }) else {
            return;
        };
        self.push_local_user_index_canister_event(user_index, LocalUserIndexEvent::NotifyChit(notify_chit), now);
    }

    // Records a payment for streak insurance by the user at `user_index`, as the User canister's
    // `mark_streak_insurance_payment`
    pub fn mark_streak_insurance_payment(&mut self, user_index: u16, payment: UserCanisterStreakInsurancePayment) {
        if self
            .data
            .users
            .with_user_mut(user_index, |user| user.streak.mark_streak_insurance_payment(payment.clone()))
            .is_none()
        {
            return;
        }
        self.set_up_streak_insurance_timer_job(user_index);

        let user_id = self.user_id(user_index);
        let now = self.env.now();
        self.push_local_user_index_canister_event(
            user_index,
            LocalUserIndexEvent::EventStoreEvent(
                EventBuilder::new("user_streak_insurance_payment", payment.timestamp)
                    .with_user(user_id.to_string(), true)
                    .with_source(user_id.to_string(), true)
                    .with_json_payload(&payment)
                    .build(),
            ),
            now,
        );
        self.push_local_user_index_canister_event(user_index, LocalUserIndexEvent::NotifyStreakInsurancePayment(payment), now);
    }

    // Records a day of streak insurance being used up to keep the streak of the user at
    // `user_index`, as the User canister's `mark_streak_insurance_claim`
    pub fn mark_streak_insurance_claim(&mut self, user_index: u16, claim: UserCanisterStreakInsuranceClaim) {
        if self
            .data
            .users
            .with_user_mut(user_index, |user| {
                user.chit_events.push(ChitEvent {
                    amount: 0,
                    timestamp: claim.timestamp,
                    reason: ChitEventType::StreakInsuranceClaim,
                })
            })
            .is_none()
        {
            return;
        }

        let user_id = self.user_id(user_index);
        let now = self.env.now();
        self.push_local_user_index_canister_event(
            user_index,
            LocalUserIndexEvent::EventStoreEvent(
                EventBuilder::new("user_streak_insurance_claim", claim.timestamp)
                    .with_user(user_id.to_string(), true)
                    .with_source(user_id.to_string(), true)
                    .with_json_payload(&claim)
                    .build(),
            ),
            now,
        );
        let new_streak = claim.streak_length;
        let days_remaining = claim.insured_days_remaining;
        self.push_local_user_index_canister_event(user_index, LocalUserIndexEvent::NotifyStreakInsuranceClaim(claim), now);

        let days_remaining_text = if days_remaining == 1 { "1 day".to_string() } else { format!("{days_remaining} days") };
        openchat_bot::send_text_message(
            user_index,
            format!(
                "One day of streak insurance was just used up to protect your streak from being lost. \
Your streak is now {new_streak} days and you have {days_remaining_text} of streak insurance remaining."
            ),
            false,
            self,
        );
    }

    // Queues the job which, when the streak of the user at `user_index` is due to end, uses up a day
    // of their streak insurance to keep it, or resets their insurance if the streak has been lost,
    // replacing any such job already queued for them. Each user has their own job.
    pub fn set_up_streak_insurance_timer_job(&mut self, user_index: u16) {
        let Some((days_insured, ends)) = self
            .data
            .users
            .with_user(user_index, |user| (user.streak.days_insured(), user.streak.ends()))
        else {
            return;
        };
        if days_insured > 0 {
            let timer_jobs = &mut self.data.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::ClaimOrResetStreakInsurance(job) if job.user_index == user_index));
            timer_jobs.enqueue_job(
                TimerJob::ClaimOrResetStreakInsurance(ClaimOrResetStreakInsuranceJob { user_index }),
                ends,
                self.env.now(),
            );
        }
    }

    // Removes the group from the user at `user_index`, garbage collecting its entries in stable memory
    pub fn remove_group(&mut self, user_index: u16, chat_id: ChatId, now: TimestampMillis) -> Option<GroupChat> {
        let (group, prefix) = self
            .data
            .users
            .with_user_mut(user_index, |user| user.remove_group(chat_id, now))
            .flatten()?;
        self.garbage_collect_removed_chat_keys(user_index, vec![prefix]);
        Some(group)
    }

    // Removes the community from the user at `user_index`, garbage collecting its channels' entries
    // in stable memory
    pub fn remove_community(&mut self, user_index: u16, community_id: CommunityId, now: TimestampMillis) -> Option<Community> {
        let (community, prefixes) = self
            .data
            .users
            .with_user_mut(user_index, |user| user.remove_community(community_id, now))
            .flatten()?;
        self.garbage_collect_removed_chat_keys(user_index, prefixes);
        Some(community)
    }

    // A removed group or community only has a small number of entries, so they are removed
    // immediately, as in the User canister, so that none are left to be wiped by a later garbage
    // collection if the user rejoins. Any which can't be removed within this message are left for
    // the garbage collection job.
    fn garbage_collect_removed_chat_keys(&mut self, user_index: u16, prefixes: Vec<BaseKeyPrefix>) {
        let remaining: Vec<_> = self
            .data
            .users
            .with_user_mut(user_index, |_| {
                prefixes
                    .into_iter()
                    .filter(|prefix| stable_memory_map::garbage_collect(prefix.clone()).is_err())
                    .collect()
            })
            .unwrap_or_default();

        if !remaining.is_empty() {
            self.garbage_collect_stable_memory_keys(user_index, remaining);
        }
    }

    // Queues the stable memory map entries of a chat deleted by the user at `user_index` for
    // removal by the garbage collection job
    pub fn garbage_collect_stable_memory_keys(&mut self, user_index: u16, prefixes: Vec<BaseKeyPrefix>) {
        self.data
            .stable_memory_keys_to_garbage_collect
            .extend(prefixes.into_iter().map(|prefix| (user_index, prefix)));

        jobs::garbage_collect_stable_memory::start_job_if_required(&self.data);
    }

    // Registers that an event in a direct chat of the user at `user_index` expires at `expiry`,
    // bringing forward the job to remove the user's expired events if it is due later than that
    pub fn handle_event_expiry(&mut self, user_index: u16, expiry: TimestampMillis) {
        let now = self.env.now();
        let is_earliest = self
            .data
            .users
            .with_user_mut(user_index, |user| {
                let is_earliest = user.next_event_expiry.is_none_or(|ex| expiry < ex);
                if is_earliest {
                    user.next_event_expiry = Some(expiry);
                }
                is_earliest
            })
            .unwrap_or_default();

        if is_earliest {
            let timer_jobs = &mut self.data.timer_jobs;
            timer_jobs.cancel_jobs(|j| matches!(j, TimerJob::RemoveExpiredEvents(job) if job.user_index == user_index));
            timer_jobs.enqueue_job(
                TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob { user_index }),
                expiry,
                now,
            );
        }
    }

    // Removes the expired events from the direct chats of the user at `user_index`, then schedules
    // the job to run again when their next event expires
    pub fn run_event_expiry_job(&mut self, user_index: u16) {
        let now = self.env.now();
        let Some((next_event_expiry, thread_prefixes)) = self.data.users.with_user_mut(user_index, |user| {
            let mut next_event_expiry = None;
            let mut thread_prefixes = Vec::new();
            for chat in user.direct_chats.iter_mut() {
                let result = chat.remove_expired_events(now);
                if let Some(expiry) = chat.events().next_event_expiry()
                    && next_event_expiry.is_none_or(|current| expiry < current)
                {
                    next_event_expiry = Some(expiry);
                }
                // TODO: Delete the files referenced by the expired messages (`result.files`), as
                // the User canister does
                //
                // Threads aren't currently enabled for direct chats, but if a thread's root message
                // expires then its entries in stable memory must be garbage collected
                for thread in result.threads {
                    thread_prefixes.extend(chat.events().thread_stable_memory_key_prefixes(thread.root_message_index));
                }
            }
            user.next_event_expiry = next_event_expiry;
            (next_event_expiry, thread_prefixes)
        }) else {
            return;
        };

        if !thread_prefixes.is_empty() {
            self.garbage_collect_stable_memory_keys(user_index, thread_prefixes);
        }
        if let Some(expiry) = next_event_expiry {
            self.data.timer_jobs.enqueue_job(
                TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob { user_index }),
                expiry,
                now,
            );
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            stable_memory_sizes: memory::memory_sizes(),
            user_count: self.data.users.len() as u32,
            stable_memory_keys_to_garbage_collect: self.data.stable_memory_keys_to_garbage_collect.len() as u32,
            deleted_users_to_garbage_collect: self.data.deleted_users_to_garbage_collect.len() as u32,
            timer_jobs: self.data.timer_jobs.len() as u32,
            queued_local_user_index_events: self.data.local_user_index_event_sync_queue.len() as u32,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                identity: self.data.identity_canister_id,
                escrow: self.data.escrow_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    // The defaults below cover MultiUser canisters created before these fields existed. None of
    // those hold any users.
    #[serde(default)]
    pub users: Users,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub group_index_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub identity_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub escrow_canister_id: CanisterId,
    #[serde(default)]
    pub video_call_operators: Vec<Principal>,
    // Events for the LocalUserIndex, each naming the user it is from. The default covers canisters
    // created before the queue existed, whose LocalUserIndex id is set after the upgrade.
    #[serde(default = "local_user_index_event_sync_queue_default")]
    pub local_user_index_event_sync_queue: BatchedTimerJobQueue<LocalUserIndexEventBatch>,
    // The prefixes of deleted direct chats, whose entries are removed by a background job, each
    // with the index of the user who held the chat since the entries are keyed under that user
    #[serde(default)]
    pub stable_memory_keys_to_garbage_collect: Vec<(u16, BaseKeyPrefix)>,
    // The indexes of deleted users, all of whose entries in the stable memory map are yet to be
    // removed by the garbage collection job
    #[serde(default)]
    pub deleted_users_to_garbage_collect: Vec<u16>,
    #[serde(default)]
    pub timer_jobs: TimerJobs<TimerJob>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    #[expect(clippy::too_many_arguments)]
    pub fn new(
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        rng_seed: [u8; 32],
        test_mode: bool,
    ) -> Data {
        Data {
            users: Users::default(),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            identity_canister_id,
            escrow_canister_id,
            video_call_operators,
            local_user_index_event_sync_queue: BatchedTimerJobQueue::new(local_user_index_canister_id, true),
            stable_memory_keys_to_garbage_collect: Vec::new(),
            deleted_users_to_garbage_collect: Vec::new(),
            timer_jobs: TimerJobs::default(),
            rng_seed,
            test_mode,
        }
    }
}

fn local_user_index_event_sync_queue_default() -> BatchedTimerJobQueue<LocalUserIndexEventBatch> {
    BatchedTimerJobQueue::new(CanisterId::anonymous(), true)
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
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub user_count: u32,
    pub stable_memory_keys_to_garbage_collect: u32,
    pub deleted_users_to_garbage_collect: u32,
    pub timer_jobs: u32,
    pub queued_local_user_index_events: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub local_user_index: CanisterId,
    pub group_index: CanisterId,
    pub identity: CanisterId,
    pub escrow: CanisterId,
}
