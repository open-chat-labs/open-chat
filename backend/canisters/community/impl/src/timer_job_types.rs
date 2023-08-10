use crate::jobs::import_groups::{finalize_group_import, mark_import_complete, process_channel_members};
use crate::mutate_state;
use canister_timer_jobs::Job;
use serde::{Deserialize, Serialize};
use types::{BlobReference, ChannelId, ChatId, MessageId, MessageIndex};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    DeleteFileReferences(DeleteFileReferencesJob),
    EndPoll(EndPollJob),
    FinalizeGroupImport(FinalizeGroupImportJob),
    ProcessGroupImportChannelMembers(ProcessGroupImportChannelMembersJob),
    MarkGroupImportComplete(MarkGroupImportCompleteJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeleteFileReferencesJob {
    pub files: Vec<BlobReference>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EndPollJob {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FinalizeGroupImportJob {
    pub group_id: ChatId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProcessGroupImportChannelMembersJob {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MarkGroupImportCompleteJob {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
            TimerJob::FinalizeGroupImport(job) => job.execute(),
            TimerJob::ProcessGroupImportChannelMembers(job) => job.execute(),
            TimerJob::MarkGroupImportComplete(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(&self) {
        mutate_state(|state| {
            let now = state.env.now();

            if let Some(content) = state.data.channels.get_mut(&self.channel_id).and_then(|channel| {
                channel
                    .chat
                    .events
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
            if let Some(channel) = state.data.channels.get_mut(&self.channel_id) {
                channel
                    .chat
                    .events
                    .end_poll(self.thread_root_message_index, self.message_index, now);
                // handle_activity_notification(state);
            }
        });
    }
}

impl Job for FinalizeGroupImportJob {
    fn execute(&self) {
        finalize_group_import(self.group_id);
    }
}

impl Job for ProcessGroupImportChannelMembersJob {
    fn execute(&self) {
        ic_cdk::spawn(process_channel_members(self.group_id, self.channel_id, self.attempt));
    }
}

impl Job for MarkGroupImportCompleteJob {
    fn execute(&self) {
        mark_import_complete(self.group_id, self.channel_id);
    }
}
