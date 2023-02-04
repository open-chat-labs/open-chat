use crate::updates::send_message::send_to_recipients_canister;
use crate::{mutate_state, read_state};
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{BlobReference, ChatId, MessageContent, MessageId, MessageIndex, UserId};
use user_canister::c2c_send_messages;
use user_canister::c2c_send_messages::SendMessageArgs;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RetrySendingFailedMessage(Box<RetrySendingFailedMessageJob>),
    RetrySendingFailedMessages(Box<RetrySendingFailedMessagesJob>),
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
    DeleteFileReferences(DeleteFileReferencesJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RetrySendingFailedMessageJob {
    pub recipient: UserId,
    pub args: C2cSendMessageArgs,
    pub attempt: u32,
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

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::RetrySendingFailedMessage(job) => job.execute(),
            TimerJob::RetrySendingFailedMessages(job) => job.execute(),
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
        }
    }
}

impl Job for RetrySendingFailedMessageJob {
    fn execute(&self) {
        let sender_name = read_state(|state| state.data.username.clone());
        let args = c2c_send_messages::Args {
            messages: vec![SendMessageArgs {
                message_id: self.args.message_id,
                sender_message_index: self.args.sender_message_index,
                content: self.args.content.clone(),
                replies_to: self.args.replies_to.clone(),
                forwarding: self.args.forwarding,
                correlation_id: self.args.correlation_id,
            }],
            sender_name,
        };
        ic_cdk::spawn(send_to_recipients_canister(self.recipient, args, self.attempt));
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
                        ic_cdk::spawn(open_storage_bucket_client::delete_files(files_to_delete));
                    }
                }
            }
        });
    }
}

impl Job for DeleteFileReferencesJob {
    fn execute(&self) {
        ic_cdk::spawn(open_storage_bucket_client::delete_files(self.files.clone()));
    }
}

// TODO delete this
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct C2cSendMessageArgs {
    pub message_id: MessageId,
    pub sender_message_index: MessageIndex,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<user_canister::c2c_send_messages::C2CReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
}
