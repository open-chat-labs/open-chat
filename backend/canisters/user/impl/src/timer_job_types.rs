use crate::mutate_state;
use crate::updates::send_message::send_to_recipients_canister;
use serde::{Deserialize, Serialize};
use timer_jobs::Job;
use types::{ChatId, MessageId, MessageIndex, UserId};
use user_canister::c2c_send_message;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RetrySendingFailedMessage(RetrySendingFailedMessageJob),
    RemoveDeletedMessageContent(RemoveDeletedMessageContentJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RetrySendingFailedMessageJob {
    pub recipient: UserId,
    pub args: c2c_send_message::Args,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemoveDeletedMessageContentJob {
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub delete_files: bool,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::RetrySendingFailedMessage(job) => job.execute(),
            TimerJob::RemoveDeletedMessageContent(job) => job.execute(),
        }
    }
}

impl Job for RetrySendingFailedMessageJob {
    fn execute(&self) {
        ic_cdk::spawn(send_to_recipients_canister(self.recipient, self.args.clone(), self.attempt));
    }
}

impl Job for RemoveDeletedMessageContentJob {
    fn execute(&self) {
        mutate_state(|state| {
            if let Some(content) = state.data.direct_chats.get_mut(&self.chat_id).and_then(|chat| {
                chat.events
                    .remove_deleted_message_content(self.thread_root_message_index, self.message_id)
            }) {
                if self.delete_files {
                    let files_to_delete = content.blob_references();
                    if !files_to_delete.is_empty() {
                        ic_cdk::spawn(open_storage_bucket_client::delete_files(files_to_delete));
                    }
                }
            }
        });
    }
}
