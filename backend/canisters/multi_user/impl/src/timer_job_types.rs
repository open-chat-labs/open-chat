use crate::updates::end_video_call::end_video_call_impl;
use crate::{RuntimeState, can_borrow_state, mutate_state, openchat_bot, read_state, run_regular_jobs};
use candid::Principal;
use canister_timer_jobs::{Job, TimerJobs};
use chat_events::{MessageContentInternal, MessageReminderContentInternal};
use cksol_minter_canister::deposit_sol_status::DepositSolStatus;
use cksol_minter_canister::{
    CKSOL_LEDGER_CANISTER_ID, CKSOL_MINTER_CANISTER_ID, RENT_EXEMPTION_THRESHOLD, SWEEP_FEE_PER_DEPOSIT,
};
use constants::{
    HOUR_IN_MS, MEMO_SOL_DEPOSIT, MEMO_SOL_DEPOSIT_FEE, MINUTE_IN_MS, OPENCHAT_BOT_USER_ID, OPENCHAT_TREASURY_CANISTER_ID,
    SECOND_IN_MS,
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
use user_core::updates::update_sol_balance::{
    FIRST_SOL_DEPOSIT_FEE, SOL_DEPOSIT_FEE, SolDepositEventPayload, sol_deposit_account,
};

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
// canister (see `sol_deposit_account`) to their wallet, so that they are credited with what they
// sent less `FIRST_SOL_DEPOSIT_FEE` or `SOL_DEPOSIT_FEE`, the rest going to the treasury, then tells
// them via the OpenChat bot. It checks every minute (every hour after the first
// day) until the minter has swept and minted the deposit. Kept if the user is deleted, since the
// ckSOL is still theirs.
#[derive(Serialize, Deserialize, Clone)]
pub struct ForwardSolDepositJob {
    pub user_index: u16,
    pub principal: Principal,
    pub deposit_id: u64,
    // Set once the deposit is minted
    pub transfers: Option<SolDepositTransfers>,
    // Attempts since the deposit was queued, or since it was minted once it has been
    pub attempt: u32,
}

// The transfers forwarding a minted deposit, fixed when it is minted so that every attempt at them
// repeats the same args, and the ledger deduplicates a retry of one which went through. They are
// told apart from other deposits' transfers by the deposit id in their memos.
#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct SolDepositTransfers {
    pub to_user: u64,
    pub to_treasury: u64,
    // What the user is charged, being what they sent less `to_user`
    pub fee: u64,
    pub ledger_fee: u64,
    pub created_at: TimestampNanos,
    // So that a retry after the treasury's transfer failed only repeats that
    pub user_paid: bool,
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
    // The minter is checked every minute for the first day, then every hour
    const MINUTELY_STATUS_CHECKS: u32 = 24 * 60;
    // Transfers are retried every minute for half a day, well within the day the ledger deduplicates
    // them for
    const MAX_TRANSFER_ATTEMPTS: u32 = 12 * 60;

    // Starts forwarding the deposit once the minter has had time to sweep it, unless it is one
    // already forwarded or being forwarded to the user
    pub fn start(user_index: u16, principal: Principal, deposit_id: u64, state: &mut RuntimeState) {
        let is_new = state
            .data
            .users
            .with_user_mut(user_index, |user| {
                let is_new = user.latest_sol_deposit_id.is_none_or(|latest| deposit_id > latest);
                if is_new {
                    user.latest_sol_deposit_id = Some(deposit_id);
                }
                is_new
            })
            .unwrap_or_default();

        if is_new {
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
        let mut transfers = match self.transfers {
            Some(transfers) => transfers,
            None => match self.wait_for_mint().await {
                Some(Ok(transfers)) => {
                    self.transfers = Some(transfers);
                    self.attempt = 0;
                    transfers
                }
                Some(Err(())) => return self.finish(),
                None => return self.retry(),
            },
        };

        if !transfers.user_paid {
            let wallet = Account {
                owner: self.principal,
                subaccount: None,
            };
            match self.transfer(wallet, transfers.to_user, &MEMO_SOL_DEPOSIT, transfers).await {
                TransferOutcome::Done => {
                    transfers.user_paid = true;
                    self.transfers = Some(transfers);
                }
                TransferOutcome::Retry => return self.retry(),
                TransferOutcome::Failed => return self.finish(),
            }
        }

        // Once the user is paid, a failure to pay the treasury leaves its fee in the user's deposit
        // account, and is logged
        if let TransferOutcome::Retry = self
            .transfer(
                OPENCHAT_TREASURY_CANISTER_ID.into(),
                transfers.to_treasury,
                &MEMO_SOL_DEPOSIT_FEE,
                transfers,
            )
            .await
        {
            return self.retry();
        }
        self.finish();
    }

    // Some(Ok) with the transfers to make once the deposit is minted, Some(Err) if it never will be,
    // or None to check again later
    async fn wait_for_mint(&self) -> Option<Result<SolDepositTransfers, ()>> {
        let status = cksol_minter_canister_c2c_client::deposit_sol_status(CKSOL_MINTER_CANISTER_ID, &self.deposit_id)
            .await
            .ok()?;

        let minted_amount = match deposit_step(&status) {
            DepositStep::Wait => return None,
            DepositStep::Forward(minted_amount) => minted_amount,
            DepositStep::Stop => {
                if matches!(status, DepositSolStatus::Dropped { .. }) {
                    // The SOL is still at the deposit address, and is swept again when next asked for
                    info!(deposit_id = self.deposit_id, "SOL deposit dropped");
                } else {
                    error!(?status, deposit_id = self.deposit_id, "SOL deposit not minted");
                }
                return Some(Err(()));
            }
        };

        let ledger_fee = icrc_ledger_canister_c2c_client::icrc1_fee(CKSOL_LEDGER_CANISTER_ID)
            .await
            .ok()?;

        let transfers = mutate_state(|state| {
            let ledger_fee = u64::try_from(&ledger_fee.0).ok();
            let created_at = state.env.now_nanos();
            // The sweep of the user's first deposit to be minted left the rent reserve on their
            // address, whether or not the deposit can be forwarded. A deleted user's deposit is
            // taken not to have, which can only charge them less.
            let first = state
                .data
                .users
                .with_user_mut(self.user_index, |user| {
                    !std::mem::replace(&mut user.sol_deposit_address_funded, true)
                })
                .unwrap_or_default();
            sol_deposit_transfers(minted_amount, ledger_fee?, first, created_at)
        });

        if transfers.is_none() {
            error!(
                minted_amount,
                ?ledger_fee,
                deposit_id = self.deposit_id,
                "SOL deposit can't cover its fees"
            );
        }
        Some(transfers.ok_or(()))
    }

    async fn transfer(&self, to: Account, amount: u64, memo_prefix: &[u8], transfers: SolDepositTransfers) -> TransferOutcome {
        let from = read_state(|state| sol_deposit_account(state.env.canister_id(), self.principal));
        let memo = [memo_prefix, &self.deposit_id.to_be_bytes()].concat();
        let response = icrc_ledger_canister_c2c_client::icrc1_transfer(
            CKSOL_LEDGER_CANISTER_ID,
            &TransferArg {
                from_subaccount: from.subaccount,
                to,
                fee: Some(transfers.ledger_fee.into()),
                created_at_time: Some(transfers.created_at),
                memo: Some(memo.into()),
                amount: amount.into(),
            },
        )
        .await;

        let outcome = match &response {
            Ok(Ok(_)) => TransferOutcome::Done,
            Ok(Err(error)) => transfer_outcome(error),
            // The call is unbounded, so an error means the transfer wasn't made
            Err(_) => TransferOutcome::Retry,
        };
        if matches!(outcome, TransferOutcome::Failed) {
            error!(?response, deposit_id = self.deposit_id, "Failed to forward SOL deposit");
        }
        outcome
    }

    fn retry(self) {
        let delay = match self.transfers {
            Some(transfers) if self.attempt >= Self::MAX_TRANSFER_ATTEMPTS => {
                error!(
                    deposit_id = self.deposit_id,
                    user_paid = transfers.user_paid,
                    "Gave up forwarding SOL deposit"
                );
                return self.finish();
            }
            Some(_) => MINUTE_IN_MS,
            // Until the minter has minted or dropped the deposit, the job keeps checking, since it is
            // the only one to forward it, the website no longer asking once the SOL is swept
            None if self.attempt < Self::MINUTELY_STATUS_CHECKS => MINUTE_IN_MS,
            None => HOUR_IN_MS,
        };
        mutate_state(|state| {
            let now = state.env.now();
            let job = ForwardSolDepositJob {
                attempt: self.attempt.saturating_add(1),
                ..self
            };
            state
                .data
                .timer_jobs
                .enqueue_job(TimerJob::ForwardSolDeposit(Box::new(job)), now + delay, now);
        });
    }

    // Tells the user of the amount forwarded to their wallet, if any, unless they have been deleted
    fn finish(self) {
        let Some(transfers) = self.transfers.filter(|t| t.user_paid) else {
            return;
        };
        let amount = transfers.to_user;
        mutate_state(|state| {
            let text = sol_deposit_received_text(
                &format_crypto_amount(amount as u128, 9),
                &format_crypto_amount(transfers.fee as u128, 9),
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

#[derive(Debug, PartialEq, Eq)]
enum DepositStep {
    // The deposit is yet to be minted
    Wait,
    // The deposit has been minted, this much ckSOL being in the user's deposit account
    Forward(u64),
    // The deposit will never be minted. Once dropped, its SOL is swept again when next asked for.
    Stop,
}

fn deposit_step(status: &DepositSolStatus) -> DepositStep {
    match status {
        DepositSolStatus::Queued { .. } | DepositSolStatus::Swept { .. } | DepositSolStatus::Finalized { .. } => {
            DepositStep::Wait
        }
        DepositSolStatus::Minted { minted_amount, .. } => DepositStep::Forward(*minted_amount),
        DepositSolStatus::Dropped { .. } | DepositSolStatus::Quarantined { .. } | DepositSolStatus::NotFound => {
            DepositStep::Stop
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum TransferOutcome {
    Done,
    Retry,
    Failed,
}

// What a transfer the ledger refused comes to, repeating it with the same args
fn transfer_outcome(error: &TransferError) -> TransferOutcome {
    match error {
        // A retry of a transfer which went through
        TransferError::Duplicate { .. } => TransferOutcome::Done,
        TransferError::TemporarilyUnavailable | TransferError::CreatedInFuture { .. } | TransferError::GenericError { .. } => {
            TransferOutcome::Retry
        }
        TransferError::BadFee { .. }
        | TransferError::BadBurn { .. }
        | TransferError::InsufficientFunds { .. }
        | TransferError::TooOld => TransferOutcome::Failed,
    }
}

// The transfers forwarding a minted deposit, which credit the user with what they sent less the fee,
// and pay the treasury the rest of what was minted, after the ledger fee each transfer pays. What the
// user sent is what was minted plus the deposit's share of the sweep's fee, plus the rent reserve if
// this was the first sweep of their address. None if the deposit doesn't cover the fee.
fn sol_deposit_transfers(
    minted_amount: u64,
    ledger_fee: u64,
    first: bool,
    created_at: TimestampNanos,
) -> Option<SolDepositTransfers> {
    let (fee, reserve) = if first { (FIRST_SOL_DEPOSIT_FEE, RENT_EXEMPTION_THRESHOLD) } else { (SOL_DEPOSIT_FEE, 0) };
    let deposited = minted_amount + SWEEP_FEE_PER_DEPOSIT + reserve;
    let to_user = deposited.checked_sub(fee).filter(|a| *a > 0)?;
    let to_treasury = minted_amount.checked_sub(to_user + 2 * ledger_fee).filter(|a| *a > 0)?;
    Some(SolDepositTransfers {
        to_user,
        to_treasury,
        fee,
        ledger_fee,
        created_at,
        user_paid: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Nat;

    // The minter's worked example: a first deposit of 1 SOL, alone in its sweep
    #[test]
    fn a_first_deposit_is_credited_less_the_first_fee() {
        let minted_amount = 999_104_120;

        let transfers = sol_deposit_transfers(minted_amount, 500, true, 0).unwrap();

        assert_eq!(transfers.to_user, 998_000_000);
        assert_eq!(transfers.fee, FIRST_SOL_DEPOSIT_FEE);
        assert_eq!(transfers.to_treasury, 1_103_120);
        assert_eq!(transfers.to_user + transfers.to_treasury + 2 * 500, minted_amount);
    }

    #[test]
    fn a_later_deposit_is_credited_less_the_lower_fee() {
        // 1 SOL, the reserve being on the address already
        let minted_amount = 999_995_000;

        let transfers = sol_deposit_transfers(minted_amount, 500, false, 0).unwrap();

        assert_eq!(transfers.to_user, 999_000_000);
        assert_eq!(transfers.fee, SOL_DEPOSIT_FEE);
        assert_eq!(transfers.to_treasury, 994_000);
        assert_eq!(transfers.to_user + transfers.to_treasury + 2 * 500, minted_amount);
    }

    #[test]
    fn the_minimum_deposit_covers_the_first_fee() {
        // 0.02 SOL, the minter's minimum
        let minted_amount = 20_000_000 - RENT_EXEMPTION_THRESHOLD - SWEEP_FEE_PER_DEPOSIT;

        let transfers = sol_deposit_transfers(minted_amount, 500, true, 0).unwrap();

        assert_eq!(transfers.to_user, 18_000_000);
    }

    #[test]
    fn a_deposit_not_covering_the_fee_is_refused() {
        assert!(sol_deposit_transfers(SOL_DEPOSIT_FEE - SWEEP_FEE_PER_DEPOSIT, 500, false, 0).is_none());
        // The treasury's share has to cover both ledger fees
        assert!(sol_deposit_transfers(10_000_000, SOL_DEPOSIT_FEE, false, 0).is_none());
    }

    #[test]
    fn deposit_step_waits_until_minted_and_stops_if_never() {
        let signature = || "sig".to_string();
        assert_eq!(
            deposit_step(&DepositSolStatus::Queued { sweepable_amount: 1 }),
            DepositStep::Wait
        );
        assert_eq!(
            deposit_step(&DepositSolStatus::Swept { signature: signature() }),
            DepositStep::Wait
        );
        assert_eq!(
            deposit_step(&DepositSolStatus::Finalized { signature: signature() }),
            DepositStep::Wait
        );
        assert_eq!(
            deposit_step(&DepositSolStatus::Minted {
                block_index: 1,
                minted_amount: 123
            }),
            DepositStep::Forward(123)
        );
        assert_eq!(
            deposit_step(&DepositSolStatus::Dropped { signature: signature() }),
            DepositStep::Stop
        );
        assert_eq!(
            deposit_step(&DepositSolStatus::Quarantined { signature: signature() }),
            DepositStep::Stop
        );
        assert_eq!(deposit_step(&DepositSolStatus::NotFound), DepositStep::Stop);
    }

    #[test]
    fn transfer_outcome_treats_a_duplicate_as_done_and_retries_transient_errors() {
        let nat = || Nat::from(1u32);
        assert_eq!(
            transfer_outcome(&TransferError::Duplicate { duplicate_of: nat() }),
            TransferOutcome::Done
        );
        assert_eq!(
            transfer_outcome(&TransferError::TemporarilyUnavailable),
            TransferOutcome::Retry
        );
        assert_eq!(
            transfer_outcome(&TransferError::CreatedInFuture { ledger_time: 1 }),
            TransferOutcome::Retry
        );
        assert_eq!(
            transfer_outcome(&TransferError::GenericError {
                error_code: nat(),
                message: String::new()
            }),
            TransferOutcome::Retry
        );
        assert_eq!(
            transfer_outcome(&TransferError::InsufficientFunds { balance: nat() }),
            TransferOutcome::Failed
        );
        assert_eq!(transfer_outcome(&TransferError::TooOld), TransferOutcome::Failed);
        assert_eq!(
            transfer_outcome(&TransferError::BadFee { expected_fee: nat() }),
            TransferOutcome::Failed
        );
    }
}
