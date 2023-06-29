use crate::updates::send_message::send_to_recipients_canister;
use crate::{mutate_state, openchat_bot, read_state};
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{BlobReference, Chat, ChatId, EventIndex, MessageContent, MessageId, MessageIndex, MessageReminderContent, UserId};
use user_canister::c2c_send_messages;
use user_canister::c2c_send_messages::C2CReplyContext;
use utils::consts::OPENCHAT_BOT_USER_ID;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RetrySendingFailedMessages(Box<RetrySendingFailedMessagesJob>),
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
    DeleteFileReferences(DeleteFileReferencesJob),
    MessageReminder(MessageReminderJob),
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
#[serde(from = "MessageReminderJobPrevious")]
pub struct MessageReminderJob {
    pub reminder_id: u64,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub reminder_created_message_index: MessageIndex,
}

// TODO: Delete this after next User release
#[derive(Serialize, Deserialize, Clone)]
pub struct MessageReminderJobPrevious {
    pub reminder_id: u64,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub reminder_created_message_index: MessageIndex,
}

impl From<MessageReminderJobPrevious> for MessageReminderJob {
    fn from(value: MessageReminderJobPrevious) -> Self {
        MessageReminderJob {
            reminder_id: value.reminder_id,
            chat: Chat::Group(value.chat_id),
            thread_root_message_index: value.thread_root_message_index,
            event_index: value.event_index,
            notes: value.notes,
            reminder_created_message_index: value.reminder_created_message_index,
        }
    }
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::RetrySendingFailedMessages(job) => job.execute(),
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::MessageReminder(job) => job.execute(),
        }
    }
}

impl Job for RetrySendingFailedMessagesJob {
    fn execute(&self) {
        let (pending_messages, sender_name) = read_state(|state| {
            (
                state
                    .data
                    .direct_chats
                    .get(&self.recipient.into())
                    .map(|c| c.get_pending_messages())
                    .unwrap_or_default(),
                state.data.username.clone(),
            )
        });

        if !pending_messages.is_empty() {
            let args = c2c_send_messages::Args::new(pending_messages, sender_name);
            ic_cdk::spawn(send_to_recipients_canister(self.recipient, args, self.attempt));
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(&self) {
        mutate_state(|state| {
            if let Some(content) = state.data.direct_chats.get_mut(&self.chat_id).and_then(|chat| {
                let now = state.env.now();
                chat.events
                    .remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
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
    fn execute(&self) {
        ic_cdk::spawn(storage_bucket_client::delete_files(self.files.clone()));
    }
}

impl Job for MessageReminderJob {
    fn execute(&self) {
        let replies_to = C2CReplyContext::OtherChat(self.chat, self.thread_root_message_index, self.event_index);
        let content = MessageContent::MessageReminder(MessageReminderContent {
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
