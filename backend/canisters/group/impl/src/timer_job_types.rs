use crate::activity_notifications::handle_activity_notification;
use crate::mutate_state;
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    EndPoll(EndPollJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EndPollJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(&self) {
        mutate_state(|state| {
            let now = state.env.now();

            if let Some(content) =
                state
                    .data
                    .events
                    .remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
            {
                let files_to_delete = content.blob_references();
                if !files_to_delete.is_empty() {
                    ic_cdk::spawn(open_storage_bucket_client::delete_files(files_to_delete));
                }
            }
        });
    }
}

impl Job for EndPollJob {
    fn execute(&self) {
        mutate_state(|state| {
            let now = state.env.now();
            state
                .data
                .events
                .end_poll(self.thread_root_message_index, self.message_index, 0, now);

            handle_activity_notification(state);
        });
    }
}
