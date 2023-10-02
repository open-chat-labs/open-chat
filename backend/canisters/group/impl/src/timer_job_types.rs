use crate::mutate_state;
use crate::{activity_notifications::handle_activity_notification, read_state};
use canister_timer_jobs::Job;
use ledger_utils::process_transaction;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{BlobReference, CanisterId, MessageId, MessageIndex, PendingCryptoTransaction};
use utils::time::HOUR_IN_MS;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    DeleteFileReferences(DeleteFileReferencesJob),
    EndPoll(EndPollJob),
    ClosePrize(ClosePrizeJob),
    MakeTransfer(MakeTransferJob),
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
pub struct ClosePrizeJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MakeTransferJob {
    pub pending_transaction: PendingCryptoTransaction,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
            TimerJob::ClosePrize(job) => job.execute(),
            TimerJob::MakeTransfer(job) => job.execute(),
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

impl Job for ClosePrizeJob {
    fn execute(&self) {
        if let Some(pending_transaction) = mutate_state(|state| {
            state
                .data
                .chat
                .events
                .close_prize(self.thread_root_message_index, self.message_index, state.env.now_nanos())
        }) {
            let make_transfer_job = MakeTransferJob { pending_transaction };
            make_transfer_job.execute();
        }
    }
}

impl Job for MakeTransferJob {
    fn execute(&self) {
        let sender = read_state(|state| state.env.canister_id());
        let pending = self.pending_transaction.clone();
        ic_cdk::spawn(make_transfer(pending, sender));

        async fn make_transfer(pending_transaction: PendingCryptoTransaction, sender: CanisterId) {
            if let Err(error) = process_transaction(pending_transaction.clone(), sender).await {
                error!(?error, "Transaction failed");
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::MakeTransfer(MakeTransferJob { pending_transaction }),
                        now + HOUR_IN_MS,
                        now,
                    );
                });
            }
        }
    }
}
