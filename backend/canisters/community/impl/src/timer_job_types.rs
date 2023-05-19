use crate::mutate_state;
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{BlobReference, CommunityGroupId, MessageId, MessageIndex};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    DeleteFileReferences(DeleteFileReferencesJob),
    EndPoll(EndPollJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeleteFileReferencesJob {
    pub files: Vec<BlobReference>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EndPollJob {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(&self) {
        mutate_state(|state| {
            let now = state.env.now();

            if let Some(content) = state.data.groups.get_mut(&self.group_id).and_then(|g| {
                g.events
                    .remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
            }) {
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
        });
    }
}

impl Job for DeleteFileReferencesJob {
    fn execute(&self) {
        ic_cdk::spawn(storage_bucket_client::delete_files(self.files.clone()));
    }
}

impl Job for EndPollJob {
    fn execute(&self) {
        mutate_state(|state| {
            let now = state.env.now();
            if let Some(group) = state.data.groups.get_mut(&self.group_id) {
                group.events.end_poll(self.thread_root_message_index, self.message_index, now);
                // handle_activity_notification(state);
            }
        });
    }
}
