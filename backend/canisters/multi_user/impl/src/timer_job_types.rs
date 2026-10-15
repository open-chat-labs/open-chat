use crate::updates::end_video_call::end_video_call_impl;
use crate::{RuntimeState, can_borrow_state, mutate_state, openchat_bot, read_state, run_regular_jobs};
use candid::Principal;
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::{MessageContentInternal, MessageReminderContentInternal};
use cksol_minter_canister::deposit_sol_status::DepositSolStatus;
use cksol_minter_canister::{CKSOL_LEDGER_CANISTER_ID, CKSOL_MINTER_CANISTER_ID};
use constants::{
    MEMO_SOL_DEPOSIT, MEMO_SOL_DEPOSIT_FEE, MINUTE_IN_MS, OPENCHAT_BOT_USER_ID, OPENCHAT_TREASURY_CANISTER_ID, SECOND_IN_MS,
};
use event_store_types::EventBuilder;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use ledger_utils::format_crypto_amount;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use multi_user_canister::C2CReplyContext;
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use types::{BlobReference, Chat, ChatId, EventIndex, MessageId, MessageIndex, P2PSwapStatus, TimestampNanos, UserId};
use user_core::openchat_bot::sol_deposit_received_text;
use user_core::updates::update_sol_balance::{SOL_DEPOSIT_FEE, SolDepositEventPayload, sol_deposit_account};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    HardDeleteMessageContent(Box<HardDeleteMessageContentJob>),
    DeleteFileReferences(DeleteFileReferencesJob),
    RemoveExpiredEvents(RemoveExpiredEventsJob),
    MessageReminder(Box<MessageReminderJob>),
    ClaimOrResetStreakInsurance(ClaimOrResetStreakInsuranceJob),
    MarkVideoCallEnded(MarkVideoCallEndedJob),
    NotifyEscrowCanisterOfDeposit(Box<NotifyEscrowCanisterOfDepositJob>),
    CancelP2PSwapInEscrowCanister(Box<CancelP2PSwapInEscrowCanisterJob>),
    MarkP2PSwapExpired(Box<MarkP2PSwapExpiredJob>),
    ForwardSolDeposit(Box<ForwardSolDepositJob>),
}

// Removes the content of a deleted message from one user's copy of a direct chat, once the time in
// which the message can be undeleted has passed
#[derive(Serialize, Deserialize, Clone)]
pub struct HardDeleteMessageContentJob {
    // The index of the user whose copy of the chat holds the message
    pub user_index: u16,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

// Deletes files from the storage buckets holding them, which the canister may do as an accessor of
// each file (the frontend names the canister holding each user in a direct chat as an accessor)
#[derive(Serialize, Deserialize, Clone)]
pub struct DeleteFileReferencesJob {
    pub files: Vec<BlobReference>,
}

// Removes the expired events from the direct chats of one user, each user having their own job,
// due when the earliest of their events expires
#[derive(Serialize, Deserialize, Clone)]
pub struct RemoveExpiredEventsJob {
    pub user_index: u16,
}

// Sends a user the reminder they set about a message, from the OpenChat bot, hiding the message
// the bot sent when the reminder was set
#[derive(Serialize, Deserialize, Clone)]
pub struct MessageReminderJob {
    pub user_index: u16,
    pub reminder_id: u64,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub event_index: EventIndex,
    pub notes: Option<String>,
    pub reminder_created_message_index: MessageIndex,
}

// When a user's streak is due to end, uses up a day of their streak insurance to keep it, or resets
// their insurance if the streak has been lost. Each insured user has their own job.
#[derive(Serialize, Deserialize, Clone)]
pub struct ClaimOrResetStreakInsuranceJob {
    pub user_index: u16,
}

// Marks a call ended in one user's copy of the chat once its maximum duration is up
#[derive(Serialize, Deserialize, Clone)]
pub struct MarkVideoCallEndedJob {
    pub user_index: u16,
    pub them: UserId,
    pub message_id: MessageId,
}

// Tells the escrow canister of a user's deposit into a swap, `depositor` being the owner of their
// wallet, by which the escrow canister knows them. Kept if the user is deleted, since the deposit
// has been made.
#[derive(Serialize, Deserialize, Clone)]
pub struct NotifyEscrowCanisterOfDepositJob {
    pub swap_id: u32,
    pub depositor: Principal,
    pub attempt: u32,
}

// Cancels a swap a user offered in the escrow canister, which refunds their deposit. Kept if the
// user is deleted, so that their deposit is still refunded.
#[derive(Serialize, Deserialize, Clone)]
pub struct CancelP2PSwapInEscrowCanisterJob {
    pub swap_id: u32,
    pub attempt: u32,
}

// Forwards the ckSOL minted for one of a user's SOL deposits from their deposit account of this
// canister (see `sol_deposit_account`) to their wallet, less `SOL_DEPOSIT_FEE`, which goes to the
// treasury, then tells them via the OpenChat bot. It checks every minute until the minter has swept
// and minted the deposit. Kept if the user is deleted, since the ckSOL is still theirs.
#[derive(Serialize, Deserialize, Clone)]
pub struct ForwardSolDepositJob {
    pub user_index: u16,
    pub principal: Principal,
    pub deposit_id: u64,
    // Fixed by the first attempt at the transfers, so that the ledger deduplicates a retry of any
    // which went through
    pub transfers: Option<SolDepositTransfers>,
    pub attempt: u32,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct SolDepositTransfers {
    pub created_at: TimestampNanos,
    pub ledger_fee: u64,
}

// Marks a swap expired in one user's copy of the chat it was offered in, once its time is up
#[derive(Serialize, Deserialize, Clone)]
pub struct MarkP2PSwapExpiredJob {
    pub user_index: u16,
    pub chat_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

impl TimerJob {
    // The index of the user the job is for, if it is for one user's state rather than the escrow
    // canister's or the storage buckets'
    pub fn user_index(&self) -> Option<u16> {
        match self {
            TimerJob::HardDeleteMessageContent(job) => Some(job.user_index),
            TimerJob::RemoveExpiredEvents(job) => Some(job.user_index),
            TimerJob::MessageReminder(job) => Some(job.user_index),
            TimerJob::ClaimOrResetStreakInsurance(job) => Some(job.user_index),
            TimerJob::MarkVideoCallEnded(job) => Some(job.user_index),
            TimerJob::MarkP2PSwapExpired(job) => Some(job.user_index),
            TimerJob::NotifyEscrowCanisterOfDeposit(_)
            | TimerJob::CancelP2PSwapInEscrowCanister(_)
            | TimerJob::DeleteFileReferences(_)
            | TimerJob::ForwardSolDeposit(_) => None,
        }
    }
}

impl HardDeleteMessageContentJob {
    // Cancels the jobs to hard delete the content of messages which have been undeleted from the
    // copy of a chat held by the user at `user_index`, so that a job queued by an earlier deletion
    // can't remove the content of a message deleted again later before its time to be undeleted
    // is up
    pub fn cancel(
        timer_jobs: &mut TimerJobs<TimerJob>,
        user_index: u16,
        chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: &[MessageId],
    ) {
        if message_ids.is_empty() {
            return;
        }
        timer_jobs.cancel_jobs(|job| match job {
            TimerJob::HardDeleteMessageContent(j) => {
                j.user_index == user_index
                    && j.chat_id == chat_id
                    && j.thread_root_message_index == thread_root_message_index
                    && message_ids.contains(&j.message_id)
            }
            _ => false,
        });
    }
}

impl Job for TimerJob {
    fn execute(self) {
        // Timer jobs which run within an update rely on it to run the regular jobs and flush events
        let can_borrow_state = can_borrow_state();
        if can_borrow_state {
            run_regular_jobs();
        }

        match self {
            TimerJob::HardDeleteMessageContent(job) => job.execute(),
            TimerJob::DeleteFileReferences(job) => job.execute(),
            TimerJob::RemoveExpiredEvents(job) => job.execute(),
            TimerJob::MessageReminder(job) => job.execute(),
            TimerJob::ClaimOrResetStreakInsurance(job) => job.execute(),
            TimerJob::MarkVideoCallEnded(job) => job.execute(),
            TimerJob::NotifyEscrowCanisterOfDeposit(job) => job.execute(),
            TimerJob::CancelP2PSwapInEscrowCanister(job) => job.execute(),
            TimerJob::MarkP2PSwapExpired(job) => job.execute(),
            TimerJob::ForwardSolDeposit(job) => job.execute(),
        }

        if can_borrow_state {
            mutate_state(|state| state.data.flush_pending_events());
        }
    }
}

impl Job for HardDeleteMessageContentJob {
    fn execute(self) {
        let Some((files_to_delete, p2p_swap_to_cancel)) = mutate_state(|state| {
            let now = state.env.now();
            let my_user_id = state.user_id(self.user_index);
            let (content, sender) = state
                .data
                .users
                .with_user_mut(self.user_index, |user| {
                    user.direct_chats.get_mut(&self.chat_id).and_then(|mut chat| {
                        chat.remove_deleted_message_content(self.thread_root_message_index, self.message_id, now)
                    })
                })
                .flatten()?;
            // Only the sender's copy of the message deletes its files and cancels its swap, since each
            // copy of the chat references the same files and swap.
            if sender != my_user_id {
                return Some((Vec::new(), None));
            }
            let files_to_delete = content.blob_references();
            // A swap the user offered which is still open is cancelled
            let p2p_swap_to_cancel = if let MessageContentInternal::P2PSwap(s) = content
                && matches!(s.status, P2PSwapStatus::Open)
            {
                Some(s.swap_id)
            } else {
                None
            };
            Some((files_to_delete, p2p_swap_to_cancel))
        }) else {
            return;
        };

        if !files_to_delete.is_empty() {
            DeleteFileReferencesJob { files: files_to_delete }.execute();
        }
        if let Some(swap_id) = p2p_swap_to_cancel {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
        }
    }
}

impl Job for DeleteFileReferencesJob {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(async move {
            let to_retry = storage_bucket_client::delete_files(self.files).await;

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

impl Job for RemoveExpiredEventsJob {
    fn execute(self) {
        mutate_state(|state| state.run_event_expiry_job(self.user_index));
    }
}

impl Job for MessageReminderJob {
    fn execute(self) {
        let replies_to = C2CReplyContext::OtherChat(self.chat, self.thread_root_message_index, self.event_index);
        let content = MessageContentInternal::MessageReminder(MessageReminderContentInternal {
            reminder_id: self.reminder_id,
            notes: self.notes,
        });

        mutate_state(|state| {
            let now = state.env.now();
            let _ = state.with_direct_chat_mut(self.user_index, OPENCHAT_BOT_USER_ID.into(), |chat| {
                chat.mark_message_reminder_created_message_hidden(self.reminder_created_message_index, now)
            });
            // Does nothing if the user no longer exists
            openchat_bot::send_message_with_reply(self.user_index, content, Some(replies_to), Vec::new(), false, state);
        });
    }
}

impl Job for ClaimOrResetStreakInsuranceJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            // Does nothing if the user no longer exists
            let Some(insurance_claim) = state.data.users.with_user_mut(self.user_index, |user| {
                let insurance_claim = user.streak.claim_via_insurance(now);
                if insurance_claim.is_none() && user.streak.days(now) == 0 {
                    user.streak.reset_streak_insurance(now);
                }
                insurance_claim
            }) else {
                return;
            };
            if let Some(insurance_claim) = insurance_claim {
                state.mark_streak_insurance_claim(self.user_index, insurance_claim);
                state.notify_user_index_of_chit(self.user_index, now);
                state.set_up_streak_insurance_timer_job(self.user_index);
            }
        });
    }
}

impl Job for MarkVideoCallEndedJob {
    fn execute(self) {
        let result = mutate_state(|state| end_video_call_impl(self.user_index, self.them, self.message_id, state));
        if let Err(error) = result {
            error!(
                ?error,
                user_index = self.user_index,
                them = ?self.them,
                message_id = ?self.message_id,
                "Failed to mark video call ended"
            );
        }
    }
}

impl NotifyEscrowCanisterOfDepositJob {
    pub fn run(swap_id: u32, depositor: Principal) {
        let job = NotifyEscrowCanisterOfDepositJob {
            swap_id,
            depositor,
            attempt: 0,
        };
        job.execute();
    }
}

impl Job for NotifyEscrowCanisterOfDepositJob {
    fn execute(self) {
        let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);

        ic_cdk::futures::spawn_migratory(async move {
            match escrow_canister_c2c_client::notify_deposit(
                escrow_canister_id,
                &escrow_canister::notify_deposit::Args {
                    swap_id: self.swap_id,
                    deposited_by: Some(self.depositor),
                },
            )
            .await
            {
                Ok(escrow_canister::notify_deposit::Response::Success(_)) => {}
                Ok(escrow_canister::notify_deposit::Response::InternalError(_)) | Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::NotifyEscrowCanisterOfDeposit(Box::new(NotifyEscrowCanisterOfDepositJob {
                                attempt: self.attempt + 1,
                                ..self
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(
                    ?response,
                    swap_id = self.swap_id,
                    "Failed to notify escrow canister of deposit"
                ),
            };
        })
    }
}

impl CancelP2PSwapInEscrowCanisterJob {
    pub fn run(swap_id: u32) {
        let job = CancelP2PSwapInEscrowCanisterJob { swap_id, attempt: 0 };
        job.execute();
    }
}

impl Job for CancelP2PSwapInEscrowCanisterJob {
    fn execute(self) {
        let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);

        ic_cdk::futures::spawn_migratory(async move {
            match escrow_canister_c2c_client::cancel_swap(
                escrow_canister_id,
                &escrow_canister::cancel_swap::Args { swap_id: self.swap_id },
            )
            .await
            {
                Ok(escrow_canister::cancel_swap::Response::Success)
                | Ok(escrow_canister::cancel_swap::Response::SwapAlreadyAccepted)
                | Ok(escrow_canister::cancel_swap::Response::SwapExpired) => {}
                Err(_) if self.attempt < 20 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::CancelP2PSwapInEscrowCanister(Box::new(CancelP2PSwapInEscrowCanisterJob {
                                swap_id: self.swap_id,
                                attempt: self.attempt + 1,
                            })),
                            now + 10 * SECOND_IN_MS,
                            now,
                        );
                    });
                }
                response => error!(?response, swap_id = self.swap_id, "Failed to cancel p2p swap"),
            };
        })
    }
}

impl Job for MarkP2PSwapExpiredJob {
    fn execute(self) {
        mutate_state(|state| {
            let now = state.env.now();
            // Does nothing if the user no longer exists
            state.data.users.with_user_mut(self.user_index, |user| {
                if let Some(mut chat) = user.direct_chats.get_mut(&self.chat_id) {
                    let _ = chat.mark_p2p_swap_expired(self.thread_root_message_index, self.message_id, now);
                }
            });
        });
    }
}

impl ForwardSolDepositJob {
    // Checks once a minute for a day before giving up on a deposit
    const MAX_ATTEMPTS: u32 = 24 * 60;

    // Starts forwarding the deposit once the minter has had time to sweep it, unless it is already
    // being forwarded
    pub fn start(user_index: u16, principal: Principal, deposit_id: u64, state: &mut RuntimeState) {
        if state.data.sol_deposits_being_forwarded.insert(deposit_id) {
            let now = state.env.now();
            let job = ForwardSolDepositJob {
                user_index,
                principal,
                deposit_id,
                transfers: None,
                attempt: 0,
            };
            state
                .data
                .timer_jobs
                .enqueue_job(TimerJob::ForwardSolDeposit(Box::new(job)), now + MINUTE_IN_MS, now);
        }
    }

    async fn run(mut self) {
        let minted_amount =
            match cksol_minter_canister_c2c_client::deposit_sol_status(CKSOL_MINTER_CANISTER_ID, &self.deposit_id).await {
                Ok(DepositSolStatus::Minted { minted_amount, .. }) => minted_amount,
                Ok(DepositSolStatus::Queued { .. } | DepositSolStatus::Swept { .. } | DepositSolStatus::Finalized { .. })
                | Err(_) => {
                    return self.retry();
                }
                Ok(DepositSolStatus::Dropped { .. }) => {
                    // The SOL is still at the deposit address, and is swept again when next asked for
                    info!(deposit_id = self.deposit_id, "SOL deposit dropped");
                    return self.finish(None);
                }
                Ok(status @ (DepositSolStatus::NotFound | DepositSolStatus::Quarantined { .. })) => {
                    error!(?status, deposit_id = self.deposit_id, "SOL deposit not minted");
                    return self.finish(None);
                }
            };

        match self.forward(minted_amount).await {
            Ok(amount) => self.finish(Some(amount)),
            Err(true) => self.retry(),
            Err(false) => self.finish(None),
        }
    }

    // Sends the minted ckSOL, less the fee, to the user's wallet, then the fee to the treasury,
    // returning what the user received. Err(true) if it is worth trying again.
    async fn forward(&mut self, minted_amount: u64) -> Result<u64, bool> {
        let transfers = match self.transfers {
            Some(transfers) => transfers,
            None => {
                let ledger_fee = icrc_ledger_canister_c2c_client::icrc1_fee(CKSOL_LEDGER_CANISTER_ID)
                    .await
                    .map_err(|_| true)?;
                let transfers = SolDepositTransfers {
                    created_at: read_state(|state| state.env.now_nanos()),
                    ledger_fee: u64::try_from(&ledger_fee.0).map_err(|_| false)?,
                };
                self.transfers = Some(transfers);
                transfers
            }
        };

        let Some((to_user, to_treasury)) = split_sol_deposit(minted_amount, transfers.ledger_fee) else {
            error!(
                minted_amount,
                deposit_id = self.deposit_id,
                "SOL deposit too small to forward"
            );
            return Err(false);
        };

        let wallet = Account {
            owner: self.principal,
            subaccount: None,
        };
        self.transfer(wallet, to_user, &MEMO_SOL_DEPOSIT, transfers).await?;
        self.transfer(
            OPENCHAT_TREASURY_CANISTER_ID.into(),
            to_treasury,
            &MEMO_SOL_DEPOSIT_FEE,
            transfers,
        )
        .await?;
        Ok(to_user)
    }

    async fn transfer(&self, to: Account, amount: u64, memo: &[u8], transfers: SolDepositTransfers) -> Result<(), bool> {
        let from = read_state(|state| sol_deposit_account(state.env.canister_id(), self.principal));
        let response = icrc_ledger_canister_c2c_client::icrc1_transfer(
            CKSOL_LEDGER_CANISTER_ID,
            &TransferArg {
                from_subaccount: from.subaccount,
                to,
                fee: Some(transfers.ledger_fee.into()),
                created_at_time: Some(transfers.created_at),
                memo: Some(memo.to_vec().into()),
                amount: amount.into(),
            },
        )
        .await;

        match response {
            // A duplicate is a retry of a transfer which went through
            Ok(Ok(_)) | Ok(Err(TransferError::Duplicate { .. })) => Ok(()),
            Ok(Err(TransferError::TemporarilyUnavailable)) | Err(_) => Err(true),
            Ok(Err(error)) => {
                error!(?error, deposit_id = self.deposit_id, "Failed to forward SOL deposit");
                Err(false)
            }
        }
    }

    fn retry(self) {
        if self.attempt >= Self::MAX_ATTEMPTS {
            error!(deposit_id = self.deposit_id, "Gave up forwarding SOL deposit");
            return self.finish(None);
        }
        mutate_state(|state| {
            let now = state.env.now();
            let job = ForwardSolDepositJob {
                attempt: self.attempt + 1,
                ..self
            };
            state
                .data
                .timer_jobs
                .enqueue_job(TimerJob::ForwardSolDeposit(Box::new(job)), now + MINUTE_IN_MS, now);
        });
    }

    // Tells the user of the amount forwarded to their wallet, if any, unless they have been deleted
    fn finish(self, forwarded: Option<u64>) {
        mutate_state(|state| {
            state.data.sol_deposits_being_forwarded.remove(&self.deposit_id);

            let Some(amount) = forwarded else {
                return;
            };
            let text = sol_deposit_received_text(
                &format_crypto_amount(amount as u128, 9),
                &format_crypto_amount(SOL_DEPOSIT_FEE as u128, 9),
            );
            if openchat_bot::send_text_message(self.user_index, text, Vec::new(), false, state).is_some() {
                let now = state.env.now();
                let user_id_string = state.user_id(self.user_index).to_string();
                state.push_local_user_index_canister_event(
                    self.user_index,
                    LocalUserIndexEvent::EventStoreEvent(
                        EventBuilder::new("sol_deposit", now)
                            .with_user(user_id_string.clone(), true)
                            .with_source(user_id_string, true)
                            .with_json_payload(&SolDepositEventPayload { amount })
                            .build(),
                    ),
                    now,
                );
            }
            state.data.flush_pending_events();
        });
    }
}

impl Job for ForwardSolDepositJob {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(self.run());
    }
}

// Splits the ckSOL minted for a deposit into what the user receives and what the treasury receives,
// after the ledger fee each transfer pays, the treasury's share being `SOL_DEPOSIT_FEE` less its
// transfer's ledger fee. None if the deposit doesn't cover them.
fn split_sol_deposit(minted_amount: u64, ledger_fee: u64) -> Option<(u64, u64)> {
    let to_treasury = SOL_DEPOSIT_FEE.checked_sub(ledger_fee).filter(|a| *a > 0)?;
    let to_user = minted_amount.checked_sub(SOL_DEPOSIT_FEE + ledger_fee).filter(|a| *a > 0)?;
    Some((to_user, to_treasury))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_sol_deposit_accounts_for_every_lamport() {
        let minted_amount = 999_099_120;
        let ledger_fee = 500;

        let (to_user, to_treasury) = split_sol_deposit(minted_amount, ledger_fee).unwrap();

        assert_eq!(to_user, 998_098_620);
        assert_eq!(to_treasury, SOL_DEPOSIT_FEE - ledger_fee);
        assert_eq!(to_user + to_treasury + 2 * ledger_fee, minted_amount);
    }

    #[test]
    fn split_sol_deposit_refuses_a_deposit_not_covering_the_fees() {
        assert!(split_sol_deposit(SOL_DEPOSIT_FEE + 500, 500).is_none());
        assert!(split_sol_deposit(SOL_DEPOSIT_FEE + 501, 500).is_some());
        assert!(split_sol_deposit(1_000_000_000, SOL_DEPOSIT_FEE).is_none());
    }
}
