use crate::updates::end_video_call::end_video_call_impl;
use crate::{can_borrow_state, mutate_state, openchat_bot, read_state, run_regular_jobs};
use candid::Principal;
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::{MessageContentInternal, MessageReminderContentInternal};
use constants::{MINUTE_IN_MS, OPENCHAT_BOT_USER_ID, SECOND_IN_MS};
use multi_user_canister::C2CReplyContext;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{BlobReference, Chat, ChatId, EventIndex, MessageId, MessageIndex, P2PSwapStatus, UserId};
use utils::mentions::replace_mentioned_users;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
    DeleteFileReferences(DeleteFileReferencesJob),
    RemoveExpiredEvents(RemoveExpiredEventsJob),
    MessageReminder(Box<MessageReminderJob>),
    ClaimOrResetStreakInsurance(ClaimOrResetStreakInsuranceJob),
    MarkVideoCallEnded(MarkVideoCallEndedJob),
    NotifyEscrowCanisterOfDeposit(Box<NotifyEscrowCanisterOfDepositJob>),
    CancelP2PSwapInEscrowCanister(Box<CancelP2PSwapInEscrowCanisterJob>),
    MarkP2PSwapExpired(Box<MarkP2PSwapExpiredJob>),
}

// Removes the content of a deleted message from one user's copy of a direct chat, once the time in
// which the message can be undeleted has passed
#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    // The index of the user whose copy of the chat holds the message
    pub user_index: u16,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

// Deletes files from the storage buckets holding them, which the canister may do as an accessor of
// each file (the frontend names the canister holding each user in a direct chat as an accessor)
#[derive(Serialize, Deserialize, Clone)]
pub struct DeleteFileReferencesJob {
    pub files: Vec<BlobReference>,
}

// Removes the expired events from the direct chats of one user, each user having their own job,
// due when the earliest of their events expires
#[derive(Serialize, Deserialize, Clone)]
pub struct RemoveExpiredEventsJob {
    pub user_index: u16,
}

// Sends a user the reminder they set about a message, from the OpenChat bot, hiding the message
// the bot sent when the reminder was set
#[derive(Serialize, Deserialize, Clone)]
pub struct MessageReminderJob {
    pub user_index: u16,
    pub reminder_id: u64,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub reminder_created_message_index: MessageIndex,
}

// When a user's streak is due to end, uses up a day of their streak insurance to keep it, or resets
// their insurance if the streak has been lost. Each insured user has their own job.
#[derive(Serialize, Deserialize, Clone)]
pub struct ClaimOrResetStreakInsuranceJob {
    pub user_index: u16,
}

// Marks a call ended in one user's copy of the chat once its maximum duration is up
#[derive(Serialize, Deserialize, Clone)]
pub struct MarkVideoCallEndedJob {
    pub user_index: u16,
    pub them: UserId,
    pub message_id: MessageId,
}

// Tells the escrow canister of a user's deposit into a swap, `depositor` being the owner of their
// wallet, by which the escrow canister knows them. Kept if the user is deleted, since the deposit
// has been made.
#[derive(Serialize, Deserialize, Clone)]
pub struct NotifyEscrowCanisterOfDepositJob {
    pub swap_id: u32,
    pub depositor: Principal,
    pub attempt: u32,
}

// Cancels a swap a user offered in the escrow canister, which refunds their deposit. Kept if the
// user is deleted, so that their deposit is still refunded.
#[derive(Serialize, Deserialize, Clone)]
pub struct CancelP2PSwapInEscrowCanisterJob {
    pub swap_id: u32,
    pub attempt: u32,
}

// Marks a swap expired in one user's copy of the chat it was offered in, once its time is up
#[derive(Serialize, Deserialize, Clone)]
pub struct MarkP2PSwapExpiredJob {
    pub user_index: u16,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

impl TimerJob {
    // The index of the user the job is for, if it is for one user's state rather than the escrow
    // canister's or the storage buckets'
    pub fn user_index(&self) -> Option<u16> {
        match self {
            TimerJob::HardDeleteMessageContent(job) => Some(job.user_index),
            TimerJob::RemoveExpiredEvents(job) => Some(job.user_index),
            TimerJob::MessageReminder(job) => Some(job.user_index),
            TimerJob::ClaimOrResetStreakInsurance(job) => Some(job.user_index),
            TimerJob::MarkVideoCallEnded(job) => Some(job.user_index),
            TimerJob::MarkP2PSwapExpired(job) => Some(job.user_index),
            TimerJob::NotifyEscrowCanisterOfDeposit(_)
            | TimerJob::CancelP2PSwapInEscrowCanister(_)
            | TimerJob::DeleteFileReferences(_) => None,
        }
    }

    // The ids of other users the job holds, which `with_latest_user_ids` replaces
    pub fn user_ids(&self) -> Vec<UserId> {
        match self {
            TimerJob::HardDeleteMessageContent(job) => vec![job.chat_id.into()],
            TimerJob::MessageReminder(job) => {
                let mut user_ids = Vec::new();
                if let Chat::Direct(chat_id) = job.chat {
                    user_ids.push(chat_id.into());
                }
                if let Some(notes) = &job.notes {
                    replace_mentioned_users(notes, |user_id| {
                        user_ids.push(user_id);
                        user_id
                    });
                }
                user_ids
            }
            TimerJob::MarkVideoCallEnded(job) => vec![job.them],
            TimerJob::MarkP2PSwapExpired(job) => vec![job.chat_id.into()],
            _ => Vec::new(),
        }
    }

    // The job with any ids held from before users were migrated to MultiUser canisters replaced, or
    // None if it holds none. An id which names a direct chat of the user the job is for is replaced
    // with `latest_chat_user_id`, which gives the id the chat is under now, and a user mentioned in
    // a reminder's notes with `latest_user_id`.
    pub fn with_latest_user_ids(
        &self,
        latest_chat_user_id: impl Fn(u16, UserId) -> UserId,
        latest_user_id: impl Fn(UserId) -> UserId,
    ) -> Option<TimerJob> {
        let latest_chat_id = |user_index: u16, chat_id: ChatId| -> Option<ChatId> {
            let latest: ChatId = latest_chat_user_id(user_index, chat_id.into()).into();
            (latest != chat_id).then_some(latest)
        };
        match self {
            TimerJob::HardDeleteMessageContent(job) => latest_chat_id(job.user_index, job.chat_id).map(|chat_id| {
                TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
                    chat_id,
                    ..(**job).clone()
                }))
            }),
            TimerJob::MessageReminder(job) => {
                let chat = match job.chat {
                    Chat::Direct(chat_id) => latest_chat_id(job.user_index, chat_id).map(Chat::Direct),
                    _ => None,
                };
                let notes = job
                    .notes
                    .as_ref()
                    .and_then(|notes| replace_mentioned_users(notes, &latest_user_id));
                (chat.is_some() || notes.is_some()).then(|| {
                    TimerJob::MessageReminder(Box::new(MessageReminderJob {
                        chat: chat.unwrap_or(job.chat),
                        notes: notes.or_else(|| job.notes.clone()),
                        ..(**job).clone()
                    }))
                })
            }
            TimerJob::MarkVideoCallEnded(job) => {
                let them = latest_chat_user_id(job.user_index, job.them);
                (them != job.them).then(|| TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob { them, ..job.clone() }))
            }
            TimerJob::MarkP2PSwapExpired(job) => latest_chat_id(job.user_index, job.chat_id).map(|chat_id| {
                TimerJob::MarkP2PSwapExpired(Box::new(MarkP2PSwapExpiredJob {
                    chat_id,
                    ..(**job).clone()
                }))
            }),
            _ => None,
        }
    }
}

impl HardDeleteMessageContentJob {
    // Cancels the jobs to hard delete the content of messages which have been undeleted from the
    // copy of a chat held by the user at `user_index`, so that a job queued by an earlier deletion
    // can't remove the content of a message deleted again later before its time to be undeleted
    // is up
    pub fn cancel(
        timer_jobs: &mut TimerJobs<TimerJob>,
        user_index: u16,
        chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: &[MessageId],
    ) {
        if message_ids.is_empty() {
            return;
        }
        timer_jobs.cancel_jobs(|job| match job {
            TimerJob::HardDeleteMessageContent(j) => {
                j.user_index == user_index
                    && j.chat_id == chat_id
                    && j.thread_root_message_index == thread_root_message_index
                    && message_ids.contains(&j.message_id)
            }
            _ => false,
        });
    }
}

impl Job for TimerJob {
    fn execute(self) {
        // Timer jobs which run within an update rely on it to run the regular jobs and flush events
        let can_borrow_state = can_borrow_state();
        if can_borrow_state {
            run_regular_jobs();
        }

        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::RemoveExpiredEvents(job) => job.execute(),
            TimerJob::MessageReminder(job) => job.execute(),
            TimerJob::ClaimOrResetStreakInsurance(job) => job.execute(),
            TimerJob::MarkVideoCallEnded(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.execute(),
            TimerJob::MarkP2PSwapExpired(job) => job.execute(),
        }

        if can_borrow_state {
            mutate_state(|state| state.data.flush_pending_events());
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        let Some((files_to_delete, p2p_swap_to_cancel)) = mutate_state(|state| {
            let now = state.env.now();
            let my_user_id = state.user_id(self.user_index);
            let (content, sender) = state
                .data
                .users
                .with_user_mut(self.user_index, |user| {
                    let chat_id = user
                        .direct_chats
                        .latest_user_id(self.chat_id.into(), &state.data.migrated_user_ids)
                        .into();
                    user.direct_chats.get_mut(&chat_id).and_then(|mut chat| {
                        chat.remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
                    })
                })
                .flatten()?;
            // Only the sender's copy of the message deletes its files and cancels its swap, since each
            // copy of the chat references the same files and swap.
            // Including a message the user sent under an earlier id, from before they were migrated.
            if !state.data.migrated_user_ids.is_same_user(sender, my_user_id) {
                return Some((Vec::new(), None));
            }
            let files_to_delete = content.blob_references();
            // A swap the user offered which is still open is cancelled
            let p2p_swap_to_cancel = if let MessageContentInternal::P2PSwap(s) = content
                && matches!(s.status, P2PSwapStatus::Open)
            {
                Some(s.swap_id)
            } else {
                None
            };
            Some((files_to_delete, p2p_swap_to_cancel))
        }) else {
            return;
        };

        if !files_to_delete.is_empty() {
            DeleteFileReferencesJob { files: files_to_delete }.execute();
        }
        if let Some(swap_id) = p2p_swap_to_cancel {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
        }
    }
}

impl Job for DeleteFileReferencesJob {
    fn execute(self) {
        utils::async_work::spawn_tracked(async move {
            let to_retry = storage_bucket_client::delete_files(self.files).await;

            if !to_retry.is_empty() {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files: to_retry }),
                        now + MINUTE_IN_MS,
                        now,
                    );
                });
            }
        });
    }
}

impl Job for RemoveExpiredEventsJob {
    fn execute(self) {
        mutate_state(|state| state.run_event_expiry_job(self.user_index));
    }
}

impl Job for MessageReminderJob {
    fn execute(self) {
        let replies_to = C2CReplyContext::OtherChat(self.chat, self.thread_root_message_index, self.event_index);
        let content = MessageContentInternal::MessageReminder(MessageReminderContentInternal {
            reminder_id: self.reminder_id,
            notes: self.notes,
        });

        mutate_state(|state| {
            let now = state.env.now();
            let _ = state.with_direct_chat_mut(self.user_index, OPENCHAT_BOT_USER_ID.into(), |chat| {
                chat.mark_message_reminder_created_message_hidden(self.reminder_created_message_index, now)
            });
            // Does nothing if the user no longer exists
            openchat_bot::send_message_with_reply(self.user_index, content, Some(replies_to), Vec::new(), false, state);
        });
    }
}

impl Job for ClaimOrResetStreakInsuranceJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            // Does nothing if the user no longer exists
            let Some(insurance_claim) = state.data.users.with_user_mut(self.user_index, |user| {
                let insurance_claim = user.streak.claim_via_insurance(now);
                if insurance_claim.is_none() && user.streak.days(now) == 0 {
                    user.streak.reset_streak_insurance(now);
                }
                insurance_claim
            }) else {
                return;
            };
            if let Some(insurance_claim) = insurance_claim {
                state.mark_streak_insurance_claim(self.user_index, insurance_claim);
                state.notify_user_index_of_chit(self.user_index, now);
                state.set_up_streak_insurance_timer_job(self.user_index);
            }
        });
    }
}

impl Job for MarkVideoCallEndedJob {
    fn execute(self) {
        let result = mutate_state(|state| {
            // The other user may have been migrated since the call started, moving the chat onto
            // their new id
            let them = state
                .data
                .users
                .with_user(self.user_index, |user| {
                    user.direct_chats.latest_user_id(self.them, &state.data.migrated_user_ids)
                })
                .unwrap_or(self.them);
            end_video_call_impl(self.user_index, them, self.message_id, state)
        });
        if let Err(error) = result {
            error!(
                ?error,
                user_index = self.user_index,
                them = ?self.them,
                message_id = ?self.message_id,
                "Failed to mark video call ended"
            );
        }
    }
}

impl NotifyEscrowCanisterOfDepositJob {
    pub fn run(swap_id: u32, depositor: Principal) {
        let job = NotifyEscrowCanisterOfDepositJob {
            swap_id,
            depositor,
            attempt: 0,
        };
        job.execute();
    }
}

impl Job for NotifyEscrowCanisterOfDepositJob {
    fn execute(self) {
        let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);

        utils::async_work::spawn_tracked(async move {
            match escrow_canister_c2c_client::notify_deposit(
                escrow_canister_id,
                &escrow_canister::notify_deposit::Args {
                    swap_id: self.swap_id,
                    deposited_by: Some(self.depositor),
                },
            )
            .await
            {
                Ok(escrow_canister::notify_deposit::Response::Success(_)) => {}
                Ok(escrow_canister::notify_deposit::Response::InternalError(_)) | Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::NotifyEscrowCanisterOfDeposit(Box::new(NotifyEscrowCanisterOfDepositJob {
                                attempt: self.attempt + 1,
                                ..self
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(
                    ?response,
                    swap_id = self.swap_id,
                    "Failed to notify escrow canister of deposit"
                ),
            };
        })
    }
}

impl CancelP2PSwapInEscrowCanisterJob {
    pub fn run(swap_id: u32) {
        let job = CancelP2PSwapInEscrowCanisterJob { swap_id, attempt: 0 };
        job.execute();
    }
}

impl Job for CancelP2PSwapInEscrowCanisterJob {
    fn execute(self) {
        let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);

        utils::async_work::spawn_tracked(async move {
            match escrow_canister_c2c_client::cancel_swap(
                escrow_canister_id,
                &escrow_canister::cancel_swap::Args { swap_id: self.swap_id },
            )
            .await
            {
                Ok(escrow_canister::cancel_swap::Response::Success)
                | Ok(escrow_canister::cancel_swap::Response::SwapAlreadyAccepted)
                | Ok(escrow_canister::cancel_swap::Response::SwapExpired) => {}
                Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::CancelP2PSwapInEscrowCanister(Box::new(CancelP2PSwapInEscrowCanisterJob {
                                swap_id: self.swap_id,
                                attempt: self.attempt + 1,
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(?response, swap_id = self.swap_id, "Failed to cancel p2p swap"),
            };
        })
    }
}

impl Job for MarkP2PSwapExpiredJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            // Does nothing if the user no longer exists
            let migrated_user_ids = &state.data.migrated_user_ids;
            state.data.users.with_user_mut(self.user_index, |user| {
                let chat_id = user
                    .direct_chats
                    .latest_user_id(self.chat_id.into(), migrated_user_ids)
                    .into();
                if let Some(mut chat) = user.direct_chats.get_mut(&chat_id) {
                    let _ = chat.mark_p2p_swap_expired(self.thread_root_message_index, self.message_id, now);
                }
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn reminder(chat: Chat, notes: Option<String>) -> TimerJob {
        TimerJob::MessageReminder(Box::new(MessageReminderJob {
            user_index: 1,
            reminder_id: 1,
            chat,
            thread_root_message_index: None,
            event_index: 1.into(),
            notes,
            reminder_created_message_index: 1.into(),
        }))
    }

    // User 2 was migrated to user 3, and user 4 to user 5, though the user's chat with user 4 was
    // left under their old id
    fn latest_chat_user_id(user_index: u16, user_id: UserId) -> UserId {
        assert_eq!(user_index, 1);
        if user_id == self::user_id(2) { self::user_id(3) } else { user_id }
    }

    fn latest_user_id(user_id: UserId) -> UserId {
        match user_id {
            u if u == self::user_id(2) => self::user_id(3),
            u if u == self::user_id(4) => self::user_id(5),
            u => u,
        }
    }

    fn with_latest_user_ids(job: &TimerJob) -> Option<TimerJob> {
        job.with_latest_user_ids(latest_chat_user_id, latest_user_id)
    }

    #[test]
    fn ids_naming_direct_chats_are_replaced_with_the_ids_the_chats_are_under() {
        let hard_delete = TimerJob::HardDeleteMessageContent(Box::new(HardDeleteMessageContentJob {
            user_index: 1,
            chat_id: user_id(2).into(),
            thread_root_message_index: None,
            message_id: 1u64.into(),
        }));
        let video_call = TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob {
            user_index: 1,
            them: user_id(2),
            message_id: 1u64.into(),
        });
        let p2p_swap = TimerJob::MarkP2PSwapExpired(Box::new(MarkP2PSwapExpiredJob {
            user_index: 1,
            chat_id: user_id(2).into(),
            thread_root_message_index: None,
            message_id: 1u64.into(),
        }));
        let direct_reminder = reminder(Chat::Direct(user_id(2).into()), None);

        for job in [&hard_delete, &video_call, &p2p_swap, &direct_reminder] {
            assert_eq!(job.user_ids(), vec![user_id(2)]);
            let updated = with_latest_user_ids(job).unwrap();
            assert_eq!(updated.user_index(), Some(1));
            assert_eq!(updated.user_ids(), vec![user_id(3)]);
            assert!(with_latest_user_ids(&updated).is_none());
        }
        // A chat left under the old id is still named by it
        assert!(with_latest_user_ids(&reminder(Chat::Direct(user_id(4).into()), None)).is_none());
        assert!(with_latest_user_ids(&reminder(Chat::Group(user_id(9).into()), None)).is_none());
        let expired_events = TimerJob::RemoveExpiredEvents(RemoveExpiredEventsJob { user_index: 1 });
        assert!(expired_events.user_ids().is_empty());
        assert!(with_latest_user_ids(&expired_events).is_none());
    }

    #[test]
    fn users_mentioned_in_a_reminders_notes_are_replaced_with_their_latest_ids() {
        let group = Chat::Group(user_id(9).into());
        let notes = |a: UserId, b: UserId| Some(format!("Ask @UserId({a}) and @UserId({b})"));
        let job = reminder(group, notes(user_id(2), user_id(4)));
        assert_eq!(job.user_ids(), vec![user_id(2), user_id(4)]);

        let Some(TimerJob::MessageReminder(updated)) = with_latest_user_ids(&job) else {
            panic!("The reminder wasn't updated");
        };
        assert_eq!(updated.notes, notes(user_id(3), user_id(5)));
        assert_eq!(updated.chat, group);

        // The chat is replaced even when the notes mention nobody who has been migrated
        let job = reminder(Chat::Direct(user_id(2).into()), notes(user_id(6), user_id(7)));
        let Some(TimerJob::MessageReminder(updated)) = with_latest_user_ids(&job) else {
            panic!("The reminder wasn't updated");
        };
        assert_eq!(updated.chat, Chat::Direct(user_id(3).into()));
        assert_eq!(updated.notes, notes(user_id(6), user_id(7)));
    }
}
