use crate::updates::end_video_call::end_video_call_impl;
use crate::{mutate_state, openchat_bot, read_state};
use candid::Principal;
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::{MessageContentInternal, MessageReminderContentInternal, ReplyContextInternal};
use constants::{OPENCHAT_BOT_USER_ID, SECOND_IN_MS};
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{Chat, ChatId, EventIndex, MessageId, MessageIndex, P2PSwapStatus, UserId};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
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

// Marks a call ended in one user's copy of the chat once its maximum duration is up, as the User
// canister's job of the same name does
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
    // canister's
    pub fn user_index(&self) -> Option<u16> {
        match self {
            TimerJob::HardDeleteMessageContent(job) => Some(job.user_index),
            TimerJob::RemoveExpiredEvents(job) => Some(job.user_index),
            TimerJob::MessageReminder(job) => Some(job.user_index),
            TimerJob::ClaimOrResetStreakInsurance(job) => Some(job.user_index),
            TimerJob::MarkVideoCallEnded(job) => Some(job.user_index),
            TimerJob::MarkP2PSwapExpired(job) => Some(job.user_index),
            TimerJob::NotifyEscrowCanisterOfDeposit(_) | TimerJob::CancelP2PSwapInEscrowCanister(_) => None,
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
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::RemoveExpiredEvents(job) => job.execute(),
            TimerJob::MessageReminder(job) => job.execute(),
            TimerJob::ClaimOrResetStreakInsurance(job) => job.execute(),
            TimerJob::MarkVideoCallEnded(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.execute(),
            TimerJob::MarkP2PSwapExpired(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        let p2p_swap_to_cancel = mutate_state(|state| {
            let now = state.env.now();
            let my_user_id = state.user_id(self.user_index);
            let (content, sender) = state
                .data
                .users
                .with_user_mut(self.user_index, |user| {
                    user.direct_chats.get_mut(&self.chat_id).and_then(|chat| {
                        chat.remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
                    })
                })
                .flatten()?;
            // TODO: If the message is the user's own, delete the files it references, as the User
            // canister does. Each copy of the chat references the same files, so they must only be
            // deleted once, from the sender's copy.
            // A swap the user offered which is still open is cancelled, as in the User canister
            if sender == my_user_id
                && let MessageContentInternal::P2PSwap(s) = content
                && matches!(s.status, P2PSwapStatus::Open)
            {
                Some(s.swap_id)
            } else {
                None
            }
        });

        if let Some(swap_id) = p2p_swap_to_cancel {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
        }
    }
}

impl Job for RemoveExpiredEventsJob {
    fn execute(self) {
        mutate_state(|state| state.run_event_expiry_job(self.user_index));
    }
}

impl Job for MessageReminderJob {
    fn execute(self) {
        let replies_to = ReplyContextInternal {
            chat_if_other: Some((self.chat.into(), self.thread_root_message_index)),
            event_index: self.event_index,
        };
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
        let result = mutate_state(|state| end_video_call_impl(self.user_index, self.them, self.message_id, state));
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

        ic_cdk::futures::spawn_migratory(async move {
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

        ic_cdk::futures::spawn_migratory(async move {
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
            state.data.users.with_user_mut(self.user_index, |user| {
                if let Some(chat) = user.direct_chats.get_mut(&self.chat_id) {
                    let _ = chat.mark_p2p_swap_expired(self.thread_root_message_index, self.message_id, now);
                }
            });
        });
    }
}
