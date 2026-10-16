// A one-off job, run on upgrade, which empties this canister's account on the ICDex CHAT/ICP pair
// ahead of the canister being retired: it withdraws the CHAT and ICP to this canister's ledger
// accounts, sends the ICP to the SNS treasury and burns the CHAT by transferring it to the CHAT
// ledger's minting account. Progress is kept in `Data::icdex_funds_recovery` (shown in `/metrics`),
// so a failed step is retried, after a delay which doubles with each failure, without repeating the
// steps before it, and a re-run once everything is done does nothing.
use crate::model::icdex_funds_recovery::{
    IcdexFundsRecovery, LedgerSweep, NextStep, amount_to_burn, amount_to_transfer, withdrawal_has_landed,
};
use crate::{RuntimeState, mutate_state, read_state};
use candid::Nat;
use constants::{CHAT_TRANSFER_FEE, ICP_TRANSFER_FEE, SNS_GOVERNANCE_CANISTER_ID};
use icdex_canister::cancelAll::Target;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, Milliseconds, TimestampMillis};
use utils::payment_retries::{MIN_RETRY_DELAY, backoff};

const ICDEX_PAIR_CANISTER_ID: &str = "52ypw-riaaa-aaaar-qadjq-cai";

pub fn start_job() {
    schedule(Duration::ZERO);
}

fn schedule(delay: Duration) {
    ic_cdk_timers::set_timer(delay, run());
}

async fn run() {
    let Some(context) = mutate_state(prepare) else {
        return;
    };
    let result = attempt(&context).await;
    mutate_state(|state| on_attempt_complete(result, state));
}

struct Context {
    this_canister_id: CanisterId,
    dex_canister_id: CanisterId,
    chat_ledger_canister_id: CanisterId,
    icp_ledger_canister_id: CanisterId,
    next_step: NextStep,
}

enum Outcome {
    Completed,
    // ICDex has yet to land its ledger transfers (or release the funds of cancelled orders), so
    // the sweep is tried again shortly
    Waiting(String),
}

fn prepare(state: &mut RuntimeState) -> Option<Context> {
    let recovery = &mut state.data.icdex_funds_recovery;
    let next_step = recovery.next_step();
    if next_step == NextStep::Done {
        if recovery.completed.is_none() {
            recovery.completed = Some(state.env.now());
        }
        info!("ICDex funds already recovered, nothing to do");
        return None;
    }
    recovery.attempts += 1;
    recovery.next_attempt_due = None;
    info!(attempt = recovery.attempts, ?next_step, "Recovering ICDex funds");

    Some(Context {
        this_canister_id: state.env.canister_id(),
        dex_canister_id: CanisterId::from_text(ICDEX_PAIR_CANISTER_ID).unwrap(),
        chat_ledger_canister_id: state.data.chat_ledger_canister_id,
        icp_ledger_canister_id: state.data.icp_ledger_canister_id,
        next_step,
    })
}

async fn attempt(context: &Context) -> Result<Outcome, String> {
    match context.next_step {
        NextStep::WithdrawFromIcdex => {
            if let Outcome::Waiting(reason) = withdraw_from_icdex(context).await? {
                return Ok(Outcome::Waiting(reason));
            }
        }
        NextStep::SweepLedgers => {}
        NextStep::Done => return Ok(Outcome::Completed),
    }
    sweep_ledgers(context).await
}

async fn withdraw_from_icdex(context: &Context) -> Result<Outcome, String> {
    let dex = context.dex_canister_id;
    let address = context.this_canister_id.to_string();

    // The funds of open orders are locked and can't be withdrawn, so cancel any first. ICDex
    // releases them asynchronously, so the withdrawal waits for a later attempt.
    let open_orders = icdex_canister_c2c_client::pending(dex, (address.clone(), None, Some(Nat::from(250u32))))
        .await
        .map_err(|e| format!("Failed to list open orders on ICDex: {e:?}"))?
        .0;
    if !open_orders.data.is_empty() {
        info!(open_orders = open_orders.data.len(), "Cancelling open orders on ICDex");
        icdex_canister_c2c_client::cancelAll(dex, (Target::SelfSa(None), None))
            .await
            .map_err(|e| format!("Failed to cancel open orders on ICDex: {e:?}"))?;
        mutate_state(|state| {
            state.data.icdex_funds_recovery.open_orders_cancelled = Some(state.env.now());
        });
        return Ok(Outcome::Waiting("Open orders cancelled on ICDex".to_string()));
    }

    let balances = icdex_canister_c2c_client::accountBalance(dex, &address)
        .await
        .map_err(|e| format!("Failed to read balances on ICDex: {e:?}"))?;
    let chat_available = nat_to_u128(balances.token0.available);
    let icp_available = nat_to_u128(balances.token1.available);
    info!(
        chat_available,
        chat_locked = %balances.token0.locked,
        icp_available,
        icp_locked = %balances.token1.locked,
        "ICDex balances before withdrawal"
    );
    mutate_state(|state| {
        let now = state.env.now();
        state
            .data
            .icdex_funds_recovery
            .record_icdex_balances(chat_available, icp_available, now);
    });

    // `None` for both amounts withdraws everything available, to this canister's default accounts
    // on the two ledgers. ICDex reports what it is sending net of the ledger fees, and sends
    // nothing for a token whose balance doesn't exceed its fee.
    let (chat, icp) = icdex_canister_c2c_client::withdraw(dex, (None, None, None))
        .await
        .map_err(|e| format!("Failed to withdraw from ICDex: {e:?}"))?;
    let chat_e8s = nat_to_u128(chat);
    let icp_e8s = nat_to_u128(icp);
    info!(chat_e8s, icp_e8s, "Withdrawn from ICDex to this canister's ledger accounts");
    mutate_state(|state| {
        let now = state.env.now();
        state.data.icdex_funds_recovery.record_withdrawal(chat_e8s, icp_e8s, now);
    });
    Ok(Outcome::Completed)
}

// Sweeps each ledger account in turn, carrying on to the second even if the first fails, so that a
// problem with one token doesn't hold up the other
async fn sweep_ledgers(context: &Context) -> Result<Outcome, String> {
    let recovery = read_state(|state| state.data.icdex_funds_recovery.clone());
    let (expected_chat_e8s, expected_icp_e8s) = recovery.expected_on_ledgers();

    let icp = if recovery.icp_sent_to_sns_treasury.is_none() {
        send_icp_to_sns_treasury(context, expected_icp_e8s).await
    } else {
        Ok(Outcome::Completed)
    };
    let chat = if recovery.chat_burned.is_none() {
        burn_chat(context, expected_chat_e8s).await
    } else {
        Ok(Outcome::Completed)
    };

    match (icp, chat) {
        (Err(icp_error), Err(chat_error)) => Err(format!("{icp_error}. {chat_error}")),
        (Err(error), _) | (_, Err(error)) => Err(error),
        (Ok(Outcome::Waiting(reason)), _) | (_, Ok(Outcome::Waiting(reason))) => Ok(Outcome::Waiting(reason)),
        (Ok(Outcome::Completed), Ok(Outcome::Completed)) => Ok(Outcome::Completed),
    }
}

async fn send_icp_to_sns_treasury(context: &Context, expected_e8s: u128) -> Result<Outcome, String> {
    let ledger = context.icp_ledger_canister_id;
    let balance = ledger_balance(ledger, context.this_canister_id).await?;
    if !withdrawal_has_landed(balance, expected_e8s) {
        return Ok(Outcome::Waiting(format!(
            "ICP withdrawn from ICDex has not landed yet: balance {balance}, expecting {expected_e8s}"
        )));
    }

    let sweep = match amount_to_transfer(balance, ICP_TRANSFER_FEE) {
        Some(amount_e8s) => {
            let args = TransferArg {
                from_subaccount: None,
                to: Account::from(SNS_GOVERNANCE_CANISTER_ID),
                fee: Some(ICP_TRANSFER_FEE.into()),
                created_at_time: None,
                memo: None,
                amount: amount_e8s.into(),
            };
            let block_index = transfer(ledger, &args).await?;
            info!(amount_e8s, block_index, "Sent the ICP to the SNS treasury");
            LedgerSweep::Transferred {
                timestamp: now(),
                amount_e8s,
                block_index,
            }
        }
        None => {
            info!(balance, "No ICP worth sending to the SNS treasury");
            LedgerSweep::NothingToTransfer {
                timestamp: now(),
                balance_e8s: balance,
            }
        }
    };
    mutate_state(|state| state.data.icdex_funds_recovery.icp_sent_to_sns_treasury = Some(sweep));
    Ok(Outcome::Completed)
}

// A transfer to the ledger's minting account is a burn. For CHAT that account is the SNS governance
// canister, which is confirmed with the ledger before anything is sent.
async fn burn_chat(context: &Context, expected_e8s: u128) -> Result<Outcome, String> {
    let ledger = context.chat_ledger_canister_id;
    let balance = ledger_balance(ledger, context.this_canister_id).await?;
    if !withdrawal_has_landed(balance, expected_e8s) {
        return Ok(Outcome::Waiting(format!(
            "CHAT withdrawn from ICDex has not landed yet: balance {balance}, expecting {expected_e8s}"
        )));
    }

    let sweep = match amount_to_burn(balance, CHAT_TRANSFER_FEE) {
        Some(amount_e8s) => {
            let minting_account = icrc_ledger_canister_c2c_client::icrc1_minting_account(ledger)
                .await
                .map_err(|e| format!("Failed to read the CHAT ledger's minting account: {e:?}"))?;
            let burn_account = Account::from(SNS_GOVERNANCE_CANISTER_ID);
            if minting_account != Some(burn_account) {
                return Err(format!(
                    "Not burning the CHAT: the ledger's minting account is {minting_account:?}, not {burn_account:?}"
                ));
            }
            let args = TransferArg {
                from_subaccount: None,
                to: burn_account,
                fee: None, // A burn pays no fee
                created_at_time: None,
                memo: None,
                amount: amount_e8s.into(),
            };
            let block_index = transfer(ledger, &args).await?;
            info!(
                amount_e8s,
                block_index,
                minting_account = %burn_account.owner,
                "Burned the CHAT by transferring it to the CHAT ledger's minting account"
            );
            LedgerSweep::Transferred {
                timestamp: now(),
                amount_e8s,
                block_index,
            }
        }
        None => {
            info!(balance, "No CHAT worth burning");
            LedgerSweep::NothingToTransfer {
                timestamp: now(),
                balance_e8s: balance,
            }
        }
    };
    mutate_state(|state| state.data.icdex_funds_recovery.chat_burned = Some(sweep));
    Ok(Outcome::Completed)
}

async fn ledger_balance(ledger: CanisterId, this_canister_id: CanisterId) -> Result<u128, String> {
    icrc_ledger_canister_c2c_client::icrc1_balance_of(ledger, &Account::from(this_canister_id))
        .await
        .map(nat_to_u128)
        .map_err(|e| format!("Failed to read balance on ledger {ledger}: {e:?}"))
}

async fn transfer(ledger: CanisterId, args: &TransferArg) -> Result<u64, String> {
    match icrc_ledger_canister_c2c_client::icrc1_transfer(ledger, args).await {
        Ok(Ok(block_index)) => Ok(nat_to_u128(block_index) as u64),
        Ok(Err(error)) => Err(format!("Ledger {ledger} rejected the transfer {args:?}: {error:?}")),
        Err(error) => Err(format!("Failed to call ledger {ledger} to transfer {args:?}: {error:?}")),
    }
}

fn on_attempt_complete(result: Result<Outcome, String>, state: &mut RuntimeState) {
    let now = state.env.now();
    let recovery = &mut state.data.icdex_funds_recovery;
    match result {
        Ok(Outcome::Completed) => {
            recovery.completed = Some(now);
            recovery.consecutive_failures = 0;
            recovery.last_error = None;
            recovery.waiting_for = None;
            info!(?recovery, "ICDex funds recovered");
        }
        Ok(Outcome::Waiting(reason)) => {
            recovery.last_error = None;
            recovery.waiting_for = Some(reason.clone());
            let delay = schedule_retry(recovery, now);
            info!(reason, delay, "ICDex funds recovery waiting, will retry");
        }
        Err(error) => {
            recovery.last_error = Some(error.clone());
            recovery.waiting_for = None;
            let delay = schedule_retry(recovery, now);
            error!(
                error,
                delay,
                attempt = recovery.attempts,
                "ICDex funds recovery failed, will retry"
            );
        }
    }
}

// Each failure (or wait) doubles the delay before the next attempt, up to an hour
fn schedule_retry(recovery: &mut IcdexFundsRecovery, now: TimestampMillis) -> Milliseconds {
    recovery.consecutive_failures = recovery.consecutive_failures.saturating_add(1);
    let delay = backoff(MIN_RETRY_DELAY, recovery.consecutive_failures);
    recovery.next_attempt_due = Some(now + delay);
    schedule(Duration::from_millis(delay));
    delay
}

fn now() -> TimestampMillis {
    read_state(|state| state.env.now())
}

fn nat_to_u128(value: Nat) -> u128 {
    u128::try_from(value.0).unwrap()
}
