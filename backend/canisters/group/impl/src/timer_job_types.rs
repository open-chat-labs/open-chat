use crate::{activity_notifications::handle_activity_notification, mutate_state, read_state};
use canister_timer_jobs::Job;
use chat_events::MessageContentInternal;
use ledger_utils::process_transaction;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{BlobReference, CanisterId, MessageId, MessageIndex, P2PSwapStatus, PendingCryptoTransaction, UserId};
use utils::consts::MEMO_PRIZE_REFUND;
use utils::time::{MINUTE_IN_MS, SECOND_IN_MS};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    DeleteFileReferences(DeleteFileReferencesJob),
    EndPoll(EndPollJob),
    RefundPrize(RefundPrizeJob),
    MakeTransfer(MakeTransferJob),
    RemoveExpiredEvents(RemoveExpiredEventsJob),
    NotifyEscrowCanisterOfDeposit(NotifyEscrowCanisterOfDepositJob),
    CancelP2PSwapInEscrowCanister(CancelP2PSwapInEscrowCanisterJob),
    MarkP2PSwapExpired(MarkP2PSwapExpiredJob),
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
pub struct RefundPrizeJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MakeTransferJob {
    pub pending_transaction: PendingCryptoTransaction,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemoveExpiredEventsJob;

#[derive(Serialize, Deserialize, Clone)]
pub struct NotifyEscrowCanisterOfDepositJob {
    pub user_id: UserId,
    pub swap_id: u32,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub transaction_index: u64,
    pub attempt: u32,
}

impl NotifyEscrowCanisterOfDepositJob {
    pub fn run(
        user_id: UserId,
        swap_id: u32,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        transaction_index: u64,
    ) {
        let job = NotifyEscrowCanisterOfDepositJob {
            user_id,
            swap_id,
            thread_root_message_index,
            message_id,
            transaction_index,
            attempt: 0,
        };
        job.execute();
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CancelP2PSwapInEscrowCanisterJob {
    pub swap_id: u32,
    pub attempt: u32,
}

impl CancelP2PSwapInEscrowCanisterJob {
    pub fn run(swap_id: u32) {
        let job = CancelP2PSwapInEscrowCanisterJob { swap_id, attempt: 0 };
        job.execute();
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MarkP2PSwapExpiredJob {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
            TimerJob::RefundPrize(job) => job.execute(),
            TimerJob::MakeTransfer(job) => job.execute(),
            TimerJob::RemoveExpiredEvents(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.execute(),
            TimerJob::MarkP2PSwapExpired(job) => job.execute(),
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        let mut follow_on_jobs = Vec::new();
        mutate_state(|state| {
            if let Some((content, sender)) = state
                .data
                .chat
                .events
                .remove_deleted_message_content(self.thread_root_message_index, self.message_id)
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
                match content {
                    MessageContentInternal::Prize(prize) => {
                        if let Some(message_index) = state
                            .data
                            .chat
                            .events
                            .message_ids(self.thread_root_message_index, self.message_id.into())
                            .map(|(_, m, _)| m)
                        {
                            // If there was already a job queued up to refund the prize, cancel it, and make the refund
                            if state
                                .data
                                .timer_jobs
                                .cancel_job(|job| {
                                    if let TimerJob::RefundPrize(j) = job {
                                        j.thread_root_message_index == self.thread_root_message_index
                                            && j.message_index == message_index
                                    } else {
                                        false
                                    }
                                })
                                .is_some()
                            {
                                if let Some(pending_transaction) =
                                    prize.prize_refund(sender, &MEMO_PRIZE_REFUND, state.env.now_nanos())
                                {
                                    follow_on_jobs.push(TimerJob::MakeTransfer(MakeTransferJob { pending_transaction }));
                                }
                            }
                        }
                    }
                    MessageContentInternal::P2PSwap(swap) => {
                        if matches!(swap.status, P2PSwapStatus::Open) {
                            follow_on_jobs.push(TimerJob::CancelP2PSwapInEscrowCanister(CancelP2PSwapInEscrowCanisterJob {
                                swap_id: swap.swap_id,
                                attempt: 0,
                            }));
                        }
                    }
                    _ => {}
                }
            }
        });

        for job in follow_on_jobs {
            job.execute();
        }
    }
}

impl Job for DeleteFileReferencesJob {
    fn execute(self) {
        ic_cdk::spawn(storage_bucket_client::delete_files(self.files.clone()));
    }
}

impl Job for EndPollJob {
    fn execute(self) {
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

impl Job for RefundPrizeJob {
    fn execute(self) {
        if let Some(pending_transaction) = read_state(|state| {
            state.data.chat.events.prize_refund(
                self.thread_root_message_index,
                self.message_index,
                &MEMO_PRIZE_REFUND,
                state.env.now_nanos(),
            )
        }) {
            let make_transfer_job = MakeTransferJob { pending_transaction };
            make_transfer_job.execute();
        }
    }
}

impl Job for MakeTransferJob {
    fn execute(self) {
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
                        now + MINUTE_IN_MS,
                        now,
                    );
                });
            }
        }
    }
}

impl Job for RemoveExpiredEventsJob {
    fn execute(self) {
        mutate_state(|state| state.run_event_expiry_job());
    }
}

impl Job for NotifyEscrowCanisterOfDepositJob {
    fn execute(self) {
        let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);

        ic_cdk::spawn(async move {
            match escrow_canister_c2c_client::notify_deposit(
                escrow_canister_id,
                &escrow_canister::notify_deposit::Args {
                    swap_id: self.swap_id,
                    user_id: Some(self.user_id),
                },
            )
            .await
            {
                Ok(escrow_canister::notify_deposit::Response::Success(_)) => {
                    mutate_state(|state| {
                        state.data.chat.events.accept_p2p_swap(
                            self.user_id,
                            self.thread_root_message_index,
                            self.message_id,
                            self.transaction_index,
                            state.env.now(),
                        );
                    });
                }
                Ok(escrow_canister::notify_deposit::Response::SwapExpired) => mutate_state(|state| {
                    state.data.chat.events.unreserve_p2p_swap(
                        self.user_id,
                        self.thread_root_message_index,
                        self.message_id,
                        state.env.now(),
                    );
                }),
                Ok(escrow_canister::notify_deposit::Response::InternalError(_)) | Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::NotifyEscrowCanisterOfDeposit(NotifyEscrowCanisterOfDepositJob {
                                swap_id: self.swap_id,
                                user_id: self.user_id,
                                thread_root_message_index: self.thread_root_message_index,
                                message_id: self.message_id,
                                transaction_index: self.transaction_index,
                                attempt: self.attempt + 1,
                            }),
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

        ic_cdk::spawn(async move {
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
                            TimerJob::CancelP2PSwapInEscrowCanister(CancelP2PSwapInEscrowCanisterJob {
                                swap_id: self.swap_id,
                                attempt: self.attempt + 1,
                            }),
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
            state
                .data
                .chat
                .events
                .mark_p2p_swap_expired(self.thread_root_message_index, self.message_id, state.env.now())
        });
    }
}
