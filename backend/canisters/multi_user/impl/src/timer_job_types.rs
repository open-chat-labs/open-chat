use crate::{mutate_state, openchat_bot, read_state};
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::{MessageContentInternal, MessageReminderContentInternal, ReplyContextInternal};
use constants::{OPENCHAT_BOT_USER_ID, SECOND_IN_MS};
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{Chat, ChatId, CommunityId, EventIndex, MessageId, MessageIndex, UserId};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
    RemoveExpiredEvents(RemoveExpiredEventsJob),
    MessageReminder(Box<MessageReminderJob>),
    ClaimOrResetStreakInsurance(ClaimOrResetStreakInsuranceJob),
    SendMessageToGroup(Box<SendMessageToGroupJob>),
    SendMessageToChannel(Box<SendMessageToChannelJob>),
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

// Retries sending a message with a transfer to a group once its transfer has been made but the call
// to the group failed, as the User canister does
#[derive(Serialize, Deserialize, Clone)]
pub struct SendMessageToGroupJob {
    pub user_index: u16,
    pub chat_id: ChatId,
    pub args: group_canister::c2c_send_message::Args,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SendMessageToChannelJob {
    pub user_index: u16,
    pub community_id: CommunityId,
    pub args: community_canister::c2c_send_message::Args,
    pub attempt: u32,
}

// Tells the escrow canister a user has deposited into a P2P swap, retrying until it is told
#[derive(Serialize, Deserialize, Clone)]
pub struct NotifyEscrowCanisterOfDepositJob {
    pub user_index: u16,
    pub swap_id: u32,
    pub user_id: UserId,
    pub attempt: u32,
}

impl NotifyEscrowCanisterOfDepositJob {
    pub fn run(user_index: u16, swap_id: u32, user_id: UserId) {
        NotifyEscrowCanisterOfDepositJob {
            user_index,
            swap_id,
            user_id,
            attempt: 0,
        }
        .execute();
    }
}

// Cancels a P2P swap a user offered in the escrow canister, which refunds their deposit
#[derive(Serialize, Deserialize, Clone)]
pub struct CancelP2PSwapInEscrowCanisterJob {
    pub user_index: u16,
    pub swap_id: u32,
    pub attempt: u32,
}

impl CancelP2PSwapInEscrowCanisterJob {
    pub fn run(user_index: u16, swap_id: u32) {
        CancelP2PSwapInEscrowCanisterJob {
            user_index,
            swap_id,
            attempt: 0,
        }
        .execute();
    }
}

// Marks a P2P swap expired in one user's copy of the message offering it
#[derive(Serialize, Deserialize, Clone)]
pub struct MarkP2PSwapExpiredJob {
    pub user_index: u16,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

impl TimerJob {
    // The index of the user the job is for
    pub fn user_index(&self) -> u16 {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.user_index,
            TimerJob::RemoveExpiredEvents(job) => job.user_index,
            TimerJob::MessageReminder(job) => job.user_index,
            TimerJob::ClaimOrResetStreakInsurance(job) => job.user_index,
            TimerJob::SendMessageToGroup(job) => job.user_index,
            TimerJob::SendMessageToChannel(job) => job.user_index,
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.user_index,
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.user_index,
            TimerJob::MarkP2PSwapExpired(job) => job.user_index,
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
            TimerJob::SendMessageToGroup(job) => job.execute(),
            TimerJob::SendMessageToChannel(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.execute(),
            TimerJob::MarkP2PSwapExpired(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.users.with_user_mut(self.user_index, |user| {
                user.direct_chats
                    .get_mut(&self.chat_id)
                    .and_then(|chat| chat.remove_deleted_message_content(self.thread_root_message_index, self.message_id, now))
            });
            // TODO: If the message is the user's own, delete the files it references and cancel
            // any P2P swap it holds which is still open, as the User canister does. Each copy of
            // the chat references the same files, so they must only be deleted once, from the
            // sender's copy.
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

impl Job for SendMessageToGroupJob {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(async move {
            match group_canister_c2c_client::c2c_send_message(self.chat_id.into(), &self.args).await {
                Ok(group_canister::c2c_send_message::Response::Success(_)) => {}
                Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::SendMessageToGroup(Box::new(SendMessageToGroupJob {
                                user_index: self.user_index,
                                chat_id: self.chat_id,
                                args: self.args,
                                attempt: self.attempt + 1,
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(?response, "Failed to send message to group"),
            };
        })
    }
}

impl Job for SendMessageToChannelJob {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(async move {
            match community_canister_c2c_client::c2c_send_message(self.community_id.into(), &self.args).await {
                Ok(community_canister::c2c_send_message::Response::Success(_)) => {}
                Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::SendMessageToChannel(Box::new(SendMessageToChannelJob {
                                user_index: self.user_index,
                                community_id: self.community_id,
                                args: self.args,
                                attempt: self.attempt + 1,
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(?response, "Failed to send message to channel"),
            };
        })
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
                    deposited_by: Some(self.user_id.as_principal()),
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
                                user_index: self.user_index,
                                swap_id: self.swap_id,
                                user_id: self.user_id,
                                attempt: self.attempt + 1,
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(?response, "Failed to notify escrow canister of deposit"),
            };
        })
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
                Ok(escrow_canister::cancel_swap::Response::Success) => {}
                Ok(escrow_canister::cancel_swap::Response::SwapAlreadyAccepted) => {}
                Ok(escrow_canister::cancel_swap::Response::SwapExpired) => {}
                Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::CancelP2PSwapInEscrowCanister(Box::new(CancelP2PSwapInEscrowCanisterJob {
                                user_index: self.user_index,
                                swap_id: self.swap_id,
                                attempt: self.attempt + 1,
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(?response, "Failed to cancel p2p swap"),
            };
        })
    }
}

impl Job for MarkP2PSwapExpiredJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.users.with_user_mut(self.user_index, |user| {
                if let Some(chat) = user.direct_chats.get_mut(&self.chat_id) {
                    let _ = chat.mark_p2p_swap_expired(self.thread_root_message_index, self.message_id, now);
                }
            });
        });
    }
}
