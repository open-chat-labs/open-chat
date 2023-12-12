use crate::model::token_swaps::TokenSwap;
use crate::updates::send_message::send_to_recipients_canister;
use crate::updates::swap_tokens::process_token_swap;
use crate::{mutate_state, openchat_bot, read_state};
use canister_timer_jobs::Job;
use chat_events::{MessageContentInternal, MessageReminderContentInternal};
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{BlobReference, Chat, ChatId, EventIndex, MessageId, MessageIndex, UserId};
use user_canister::c2c_send_messages;
use user_canister::c2c_send_messages::C2CReplyContext;
use utils::consts::OPENCHAT_BOT_USER_ID;
use utils::time::SECOND_IN_MS;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RetrySendingFailedMessages(Box<RetrySendingFailedMessagesJob>),
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
    DeleteFileReferences(DeleteFileReferencesJob),
    MessageReminder(Box<MessageReminderJob>),
    RemoveExpiredEvents(RemoveExpiredEventsJob),
    ProcessTokenSwap(Box<ProcessTokenSwapJob>),
    NotifyEscrowCanisterOfDeposit(Box<NotifyEscrowCanisterOfDepositJob>),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RetrySendingFailedMessagesJob {
    pub recipient: UserId,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete_files: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeleteFileReferencesJob {
    pub files: Vec<BlobReference>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MessageReminderJob {
    pub reminder_id: u64,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub reminder_created_message_index: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemoveExpiredEventsJob;

#[derive(Serialize, Deserialize, Clone)]
pub struct ProcessTokenSwapJob {
    pub token_swap: TokenSwap,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NotifyEscrowCanisterOfDepositJob {
    pub offer_id: u32,
    pub attempt: u32,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::RetrySendingFailedMessages(job) => job.execute(),
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::MessageReminder(job) => job.execute(),
            TimerJob::RemoveExpiredEvents(job) => job.execute(),
            TimerJob::ProcessTokenSwap(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
        }
    }
}

impl Job for RetrySendingFailedMessagesJob {
    fn execute(self) {
        let (pending_messages, sender_name, sender_display_name, sender_avatar_id) = read_state(|state| {
            (
                state
                    .data
                    .direct_chats
                    .get(&self.recipient.into())
                    .map(|c| c.get_pending_messages())
                    .unwrap_or_default(),
                state.data.username.value.clone(),
                state.data.display_name.value.clone(),
                state.data.avatar.value.as_ref().map(|d| d.id),
            )
        });

        if !pending_messages.is_empty() {
            let args = c2c_send_messages::Args::new(pending_messages, sender_name, sender_display_name, sender_avatar_id);
            ic_cdk::spawn(send_to_recipients_canister(self.recipient, args, self.attempt));
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        mutate_state(|state| {
            if let Some((content, _)) = state.data.direct_chats.get_mut(&self.chat_id).and_then(|chat| {
                chat.events
                    .remove_deleted_message_content(self.thread_root_message_index, self.message_id)
            }) {
                if self.delete_files {
                    let files_to_delete = content.blob_references();
                    if !files_to_delete.is_empty() {
                        // If there was already a job queued up to delete these files, cancel it
                        state.data.timer_jobs.cancel_jobs(|job| {
                            if let TimerJob::DeleteFileReferences(j) = job {
                                j.files.iter().all(|f| files_to_delete.contains(f))
                            } else {
                                false
                            }
                        });
                        ic_cdk::spawn(storage_bucket_client::delete_files(files_to_delete));
                    }
                }
            }
        });
    }
}

impl Job for DeleteFileReferencesJob {
    fn execute(self) {
        ic_cdk::spawn(storage_bucket_client::delete_files(self.files.clone()));
    }
}

impl Job for MessageReminderJob {
    fn execute(self) {
        let replies_to = C2CReplyContext::OtherChat(self.chat, self.thread_root_message_index, self.event_index);
        let content = MessageContentInternal::MessageReminder(MessageReminderContentInternal {
            reminder_id: self.reminder_id,
            notes: self.notes.clone(),
        });

        mutate_state(|state| {
            if let Some(chat) = state.data.direct_chats.get_mut(&OPENCHAT_BOT_USER_ID.into()) {
                let now = state.env.now();
                chat.events
                    .mark_message_reminder_created_message_hidden(self.reminder_created_message_index, now);
            }
            openchat_bot::send_message_with_reply(content, Some(replies_to), false, state)
        });
    }
}

impl Job for RemoveExpiredEventsJob {
    fn execute(self) {
        mutate_state(|state| state.run_event_expiry_job());
    }
}

impl Job for ProcessTokenSwapJob {
    fn execute(self) {
        ic_cdk::spawn(async move {
            process_token_swap(self.token_swap, self.attempt).await;
        });
    }
}

impl Job for NotifyEscrowCanisterOfDepositJob {
    fn execute(self) {
        let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);

        ic_cdk::spawn(async move {
            match escrow_canister_c2c_client::notify_deposit(
                escrow_canister_id,
                &escrow_canister::notify_deposit::Args {
                    offer_id: self.offer_id,
                    user_id: None,
                },
            )
            .await
            {
                Ok(escrow_canister::notify_deposit::Response::Success) => {}
                Ok(escrow_canister::notify_deposit::Response::InternalError(_)) | Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::NotifyEscrowCanisterOfDeposit(Box::new(NotifyEscrowCanisterOfDepositJob {
                                offer_id: self.offer_id,
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
