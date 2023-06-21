use crate::activity_notifications::handle_activity_notification;
use crate::mutate_state;
use canister_timer_jobs::Job;
use group_index_canister::c2c_update_group;
use serde::{Deserialize, Serialize};
use types::{BlobReference, CanisterId, Document, MessageId, MessageIndex};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    DeleteFileReferences(DeleteFileReferencesJob),
    EndPoll(EndPollJob),
    SyncGroupGate(SyncGroupGateJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeleteFileReferencesJob {
    pub files: Vec<BlobReference>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EndPollJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SyncGroupGateJob {}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
            TimerJob::SyncGroupGate(job) => job.execute(),
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
                    .chat
                    .events
                    .remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
            {
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
            state
                .data
                .chat
                .events
                .end_poll(self.thread_root_message_index, self.message_index, now);

            handle_activity_notification(state);
        });
    }
}

impl Job for SyncGroupGateJob {
    fn execute(&self) {
        let result = mutate_state(|state| {
            if state.data.synced_gate_with_group_index {
                return None;
            }

            state.data.synced_gate_with_group_index = true;

            if state.data.chat.gate.value.is_some() {
                let c2c_update_group_args = c2c_update_group::Args {
                    name: state.data.chat.name.clone(),
                    description: state.data.chat.description.clone(),
                    avatar_id: Document::id(&state.data.chat.avatar),
                    gate: state.data.chat.gate.value.clone(),
                };

                Some((state.data.group_index_canister_id, c2c_update_group_args))
            } else {
                None
            }
        });

        async fn update_group_index(group_index_canister_id: CanisterId, c2c_update_group_args: c2c_update_group::Args) {
            if group_index_canister_c2c_client::c2c_update_group(group_index_canister_id, &c2c_update_group_args)
                .await
                .is_err()
            {
                mutate_state(|state| {
                    state.data.synced_gate_with_group_index = false;
                });
            }
        }

        if let Some((group_index_canister_id, c2c_update_group_args)) = result {
            ic_cdk::spawn(update_group_index(group_index_canister_id, c2c_update_group_args));
        }
    }
}
