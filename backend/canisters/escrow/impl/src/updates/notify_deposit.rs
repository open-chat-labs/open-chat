use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use escrow_canister::notify_deposit::{Response::*, *};
use icrc_ledger_types::icrc1::account::Account;
use tracing::info;
use types::TokenInfo;

#[update(candid = true, msgpack = true)]
#[trace]
async fn notify_deposit(args: Args) -> Response {
    match mutate_state(|state| prepare(&args, state)) {
        PrepareResult::Success(success) => {
            process_swap(
                args.swap_id,
                success.principal,
                success.token_info,
                success.account,
                success.balance_required,
                success.refunds_finished,
            )
            .await
        }
        PrepareResult::ErrorCheckForRefund(error) => {
            if let Err(err) = check_for_refund(args.swap_id, error.principal, error.token_info, error.account).await {
                InternalError(err)
            } else {
                error.response
            }
        }
        PrepareResult::Error(response) => response,
    }
}

// The number of times a deposit's balance is checked before giving up, should a refund from its
// subaccount finish each time while the balance is being checked
const MAX_BALANCE_CHECKS: usize = 3;

async fn process_swap(
    swap_id: u32,
    principal: Principal,
    token_info: TokenInfo,
    account: Account,
    balance_required: u128,
    mut refunds_finished: u32,
) -> Response {
    for _ in 0..MAX_BALANCE_CHECKS {
        let balance = match icrc_ledger_canister_c2c_client::icrc1_balance_of(token_info.ledger, &account)
            .await
            .map(|b| u128::try_from(b.0).unwrap())
        {
            Ok(balance) => balance,
            Err(error) => return InternalError(format!("{error:?}")),
        };

        match mutate_state(|state| {
            try_record_deposit(
                swap_id,
                principal,
                &token_info,
                balance,
                balance_required,
                refunds_finished,
                state,
            )
        }) {
            Ok(response) => return response,
            Err(finished) => {
                info!(
                    swap_id,
                    %principal,
                    "A refund from the deposit's subaccount finished while its balance was being checked, so checking it again"
                );
                refunds_finished = finished;
            }
        }
    }

    InternalError(
        "Refunds from the deposit's subaccount kept being made while its balance was being checked. Please try again."
            .to_string(),
    )
}

// Records the deposit, given its `balance` and the number of refunds from its subaccount which had
// finished before the balance was checked. If one has finished since, the balance can't be relied on,
// so the number which have now finished is returned instead, for the balance to be checked again.
fn try_record_deposit(
    swap_id: u32,
    principal: Principal,
    token_info: &TokenInfo,
    balance: u128,
    balance_required: u128,
    refunds_finished: u32,
    state: &mut RuntimeState,
) -> Result<Response, u32> {
    let now = state.env.now();
    let swap = state.data.swaps.get_mut(swap_id).unwrap();

    // Another call for the same deposit may have recorded it while the balance was being
    // checked, in which case it is left as it is: refunding it would take back funds the
    // swap still holds for its payouts
    let offered_by_depositor = principal == swap.offered_by;
    if (offered_by_depositor && swap.token0_received)
        || (swap.accepted_by.is_some_and(|(accepted_by, _)| accepted_by == principal) && swap.token1_received)
    {
        return Ok(Success(SuccessResult {
            complete: swap.token0_received && swap.token1_received,
        }));
    }

    // The swap may have expired, been cancelled or been accepted by someone else while the
    // balance was being checked, in which case the deposit is refunded rather than
    // recorded. Recording it would leave it with nothing to refund it, or take the swap over
    // from its acceptor.
    let unavailable = if now >= swap.expires_at {
        Some(SwapExpired)
    } else if swap.cancelled_at.is_some() {
        Some(SwapCancelled)
    } else if !offered_by_depositor && swap.accepted_by.is_some_and(|(accepted_by, _)| accepted_by != principal) {
        Some(SwapAlreadyAccepted)
    } else {
        None
    };
    if let Some(response) = unavailable {
        if balance > token_info.fee {
            let amount = balance - token_info.fee;
            state
                .data
                .pending_payments_queue
                .push_refund(swap, principal, token_info.clone(), amount, now);
            crate::jobs::make_pending_payments::start_job_if_required(state);
        }
        return Ok(response);
    }

    // A refund from the deposit's subaccount which was made (or given up on) while the balance was
    // being checked may or may not show in the balance, so the balance can't be relied on
    let refunds = swap.deposit_refunds(principal);
    if refunds.finished != refunds_finished {
        return Err(refunds.finished);
    }

    // Refunds from the subaccount which are yet to be made will take funds out of it, which therefore
    // don't count towards the deposit. Otherwise a deposit which is too low could be topped up and
    // recorded before its refund is made, which would then drain it, leaving the swap's payout from it
    // short. A refund which the ledger has made, but whose response hasn't arrived yet, shows in the
    // balance and is subtracted too, which errs on the safe side.
    let balance = balance.saturating_sub(refunds.outstanding);

    if balance < balance_required {
        if balance > token_info.fee {
            let amount = balance - token_info.fee;
            state
                .data
                .pending_payments_queue
                .push_refund(swap, principal, token_info.clone(), amount, now);
            crate::jobs::make_pending_payments::start_job_if_required(state);
        }
        Ok(BalanceTooLow(BalanceTooLowResult {
            balance,
            balance_required,
        }))
    } else {
        if principal == swap.offered_by {
            swap.token0_received = true;
        } else {
            swap.accepted_by = Some((principal, now));
            swap.token1_received = true;
        }
        let complete = swap.token0_received && swap.token1_received;
        if complete {
            let accepted_by = swap.accepted_by.unwrap().0;
            state.data.pending_payments_queue.push_payout(PendingPayment {
                principal: swap.offered_by,
                timestamp: now,
                token_info: swap.token1.clone(),
                amount: swap.amount1,
                swap_id: swap.id,
                reason: PendingPaymentReason::Swap(accepted_by),
            });
            state.data.pending_payments_queue.push_payout(PendingPayment {
                principal: accepted_by,
                timestamp: now,
                token_info: swap.token0.clone(),
                amount: swap.amount0,
                swap_id: swap.id,
                reason: PendingPaymentReason::Swap(swap.offered_by),
            });
            crate::jobs::make_pending_payments::start_job_if_required(state);
        }
        Ok(Success(SuccessResult { complete }))
    }
}

async fn check_for_refund(swap_id: u32, principal: Principal, token_info: TokenInfo, account: Account) -> Result<(), String> {
    match icrc_ledger_canister_c2c_client::icrc1_balance_of(token_info.ledger, &account)
        .await
        .map(|b| u128::try_from(b.0).unwrap())
    {
        Ok(balance) => {
            if balance > token_info.fee {
                mutate_state(|state| {
                    let now = state.env.now();
                    let swap = state.data.swaps.get_mut(swap_id).unwrap();
                    let amount = balance - token_info.fee;
                    state
                        .data
                        .pending_payments_queue
                        .push_refund(swap, principal, token_info, amount, now);
                    crate::jobs::make_pending_payments::start_job_if_required(state);
                });
            }
            Ok(())
        }
        Err(error) => Err(format!("Failed to check balance for refund: {error:?}")),
    }
}

enum PrepareResult {
    Success(PrepareSuccess),
    ErrorCheckForRefund(PrepareError),
    Error(Response),
}
struct PrepareSuccess {
    principal: Principal,
    token_info: TokenInfo,
    account: Account,
    balance_required: u128,
    // The number of refunds from the deposit's subaccount which had been made or given up on before
    // its balance was checked
    refunds_finished: u32,
}

struct PrepareError {
    principal: Principal,
    token_info: TokenInfo,
    account: Account,
    response: Response,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> PrepareResult {
    let Some(swap) = state.data.swaps.get_mut(args.swap_id) else {
        return PrepareResult::Error(SwapNotFound);
    };

    let now = state.env.now();
    let expired = now >= swap.expires_at;

    let principal = args.deposited_by.unwrap_or_else(|| state.env.caller());
    let escrow_canister_id = state.env.canister_id();

    if swap.offered_by == principal {
        let token_info = swap.token0.clone();
        let account = Account {
            owner: escrow_canister_id,
            subaccount: Some(deposit_subaccount(principal, swap.id)),
        };

        // A recorded deposit is held for the swap's payout to the acceptor until that is made, whether
        // or not the swap has since expired, unless it ended before being accepted, in which case it
        // is refunded by the swap's cancellation or expiry
        if swap.token0_received
            && swap.token0_transfer_out.is_none()
            && (swap.token1_received || (!expired && swap.cancelled_at.is_none()))
        {
            return PrepareResult::Error(Success(SuccessResult {
                complete: swap.token1_received,
            }));
        }

        let response = if expired {
            SwapExpired
        } else if swap.cancelled_at.is_some() {
            SwapCancelled
        } else if swap.token0_received {
            // Paid out already, so only an overpayment can be left to refund
            Success(SuccessResult {
                complete: swap.token1_received,
            })
        } else {
            return PrepareResult::Success(PrepareSuccess {
                principal,
                account,
                balance_required: swap.amount0 + swap.token0.fee,
                token_info,
                refunds_finished: swap.deposit_refunds(principal).finished,
            });
        };
        PrepareResult::ErrorCheckForRefund(PrepareError {
            principal,
            account,
            token_info,
            response,
        })
    } else {
        let token_info = swap.token1.clone();
        let account = Account {
            owner: escrow_canister_id,
            subaccount: Some(deposit_subaccount(principal, swap.id)),
        };

        // As for the offerer, a recorded deposit is held for the swap's payout to the offerer until
        // that is made. `accepted_by` is only set once the acceptor's deposit is recorded.
        let accepted_by_depositor = swap.accepted_by.is_some_and(|(accepted_by, _)| accepted_by == principal);
        if accepted_by_depositor
            && swap.token1_transfer_out.is_none()
            && (swap.token0_received || (!expired && swap.cancelled_at.is_none()))
        {
            return PrepareResult::Error(Success(SuccessResult {
                complete: swap.token0_received,
            }));
        }

        let response = if expired {
            SwapExpired
        } else if swap.cancelled_at.is_some() {
            SwapCancelled
        } else if let Some((accepted_by, _)) = swap.accepted_by {
            if accepted_by == principal {
                // Paid out already, so only an overpayment can be left to refund
                Success(SuccessResult {
                    complete: swap.token0_received,
                })
            } else {
                SwapAlreadyAccepted
            }
        } else if swap.restricted_to.is_none_or(|p| p == principal) {
            return PrepareResult::Success(PrepareSuccess {
                principal,
                account,
                balance_required: swap.amount1 + token_info.fee,
                token_info,
                refunds_finished: swap.deposit_refunds(principal).finished,
            });
        } else {
            NotAuthorized
        };

        PrepareResult::ErrorCheckForRefund(PrepareError {
            principal,
            token_info,
            account,
            response,
        })
    }
}
