use crate::updates::end_video_call::end_video_call_impl;
use crate::{
    activity_notifications::handle_activity_notification, can_borrow_state, mutate_state, read_state, run_regular_jobs,
};
use canister_timer_jobs::Job;
use chat_events::MessageContentInternal;
use constants::{DAY_IN_MS, MINUTE_IN_MS, NANOS_PER_MILLISECOND, SECOND_IN_MS};
use ledger_utils::process_transaction;
use rand::rngs::StdRng;
use rand::SeedableRng;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{BlobReference, CanisterId, MessageId, MessageIndex, P2PSwapStatus, PendingCryptoTransaction, UserId};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(HardDeleteMessageContentJob),
    DeleteFileReferences(DeleteFileReferencesJob),
    EndPoll(EndPollJob),
    FinalPrizePayments(FinalPrizePaymentsJob),
    MakeTransfer(Box<MakeTransferJob>),
    RemoveExpiredEvents(RemoveExpiredEventsJob),
    NotifyEscrowCanisterOfDeposit(NotifyEscrowCanisterOfDepositJob),
    CancelP2PSwapInEscrowCanister(CancelP2PSwapInEscrowCanisterJob),
    MarkP2PSwapExpired(MarkP2PSwapExpiredJob),
    MarkVideoCallEnded(MarkVideoCallEndedJob),
    DedupeMessageIds(DedupeMessageIdsJob),
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
pub struct FinalPrizePaymentsJob {
    pub message_index: MessageIndex,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MakeTransferJob {
    pub pending_transaction: PendingCryptoTransaction,
    pub attempt: u32,
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

#[derive(Serialize, Deserialize, Clone)]
pub struct MarkVideoCallEndedJob(pub group_canister::end_video_call_v2::Args);

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DedupeMessageIdsJob {
    iteration: u32,
}

impl Job for TimerJob {
    fn execute(self) {
        if can_borrow_state() {
            run_regular_jobs();
        }

        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::EndPoll(job) => job.execute(),
            TimerJob::FinalPrizePayments(job) => job.execute(),
            TimerJob::MakeTransfer(job) => job.execute(),
            TimerJob::RemoveExpiredEvents(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.execute(),
            TimerJob::MarkP2PSwapExpired(job) => job.execute(),
            TimerJob::MarkVideoCallEnded(job) => job.execute(),
            TimerJob::DedupeMessageIds(job) => job.execute(),
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
                    let delete_files_job = DeleteFileReferencesJob { files: files_to_delete };
                    delete_files_job.execute();
                }
                match content {
                    MessageContentInternal::Prize(mut prize) => {
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
                                    if let TimerJob::FinalPrizePayments(j) = job {
                                        j.message_index == message_index
                                    } else {
                                        false
                                    }
                                })
                                .is_some()
                            {
                                for pending_transaction in prize.final_payments(sender, state.env.now_nanos()) {
                                    follow_on_jobs.push(TimerJob::MakeTransfer(Box::new(MakeTransferJob {
                                        pending_transaction,
                                        attempt: 0,
                                    })));
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
        ic_cdk::spawn(async move {
            let to_retry = storage_bucket_client::delete_files(self.files.clone()).await;

            if !to_retry.is_empty() {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::DeleteFileReferences(DeleteFileReferencesJob { files: to_retry }),
                        now + MINUTE_IN_MS,
                        now,
                    );
                });
            }
        });
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

impl Job for FinalPrizePaymentsJob {
    fn execute(self) {
        let pending_transactions = mutate_state(|state| {
            state
                .data
                .chat
                .events
                .final_payments(self.message_index, state.env.now_nanos())
        });

        for pending_transaction in pending_transactions {
            let make_transfer_job = MakeTransferJob {
                pending_transaction,
                attempt: 0,
            };
            make_transfer_job.execute();
        }
    }
}

impl Job for MakeTransferJob {
    fn execute(self) {
        let sender = read_state(|state| state.env.canister_id());
        let pending = self.pending_transaction.clone();
        ic_cdk::spawn(make_transfer(pending, sender, self.attempt));

        async fn make_transfer(mut pending_transaction: PendingCryptoTransaction, sender: CanisterId, attempt: u32) {
            if let Err(error) = process_transaction(pending_transaction.clone(), sender, true).await {
                error!(?error, "Transaction failed");
                if attempt < 50 {
                    mutate_state(|state| {
                        let now = state.env.now();
                        if (pending_transaction.created() / NANOS_PER_MILLISECOND) + DAY_IN_MS < now {
                            pending_transaction.set_created(now * NANOS_PER_MILLISECOND);
                        }
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::MakeTransfer(Box::new(MakeTransferJob {
                                pending_transaction,
                                attempt: attempt + 1,
                            })),
                            now + MINUTE_IN_MS,
                            now,
                        );
                    });
                }
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

impl Job for MarkVideoCallEndedJob {
    fn execute(self) {
        let response = mutate_state(|state| end_video_call_impl(self.0.clone(), state));
        if !matches!(response, group_canister::end_video_call_v2::Response::Success) {
            error!(?response, args = ?self.0, "Failed to mark video call ended");
        }
    }
}

impl Job for DedupeMessageIdsJob {
    fn execute(mut self) {
        mutate_state(|state| {
            let seed = state.env.entropy();
            let mut rng = StdRng::from_seed(seed);
            match state.data.chat.events.fix_duplicate_message_ids(&mut rng) {
                Some(true) => {
                    state.data.message_ids_deduped = true;
                }
                Some(false) => {
                    if self.iteration < 100 {
                        self.iteration += 1;
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(TimerJob::DedupeMessageIds(self), now, now);
                    } else {
                        error!("Failed to dedupe messageIds after 100 iterations");
                    }
                }
                None => error!("Failed to dedupe messageIds"),
            }
        })
    }
}
