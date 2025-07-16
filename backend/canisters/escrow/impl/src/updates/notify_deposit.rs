use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use escrow_canister::notify_deposit::{Response::*, *};
use icrc_ledger_types::icrc1::account::Account;
use types::CanisterId;

#[update(candid = true, msgpack = true)]
#[trace]
async fn notify_deposit(args: Args) -> Response {
    let PrepareResult {
        principal,
        ledger,
        account,
        balance_required,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match icrc_ledger_canister_c2c_client::icrc1_balance_of(ledger, &account)
        .await
        .map(|b| u128::try_from(b.0).unwrap())
    {
        Ok(balance) => mutate_state(|state| {
            let swap = state.data.swaps.get_mut(args.swap_id).unwrap();
            if balance < balance_required {
                BalanceTooLow(BalanceTooLowResult {
                    balance,
                    balance_required,
                })
            } else {
                let now = state.env.now();
                if principal == swap.offered_by {
                    swap.token0_received = true;
                } else {
                    swap.accepted_by = Some((principal, now));
                    swap.token1_received = true;
                }
                let complete = swap.token0_received && swap.token1_received;
                if complete {
                    let accepted_by = swap.accepted_by.unwrap().0;
                    state.data.pending_payments_queue.push(PendingPayment {
                        principal: swap.offered_by,
                        timestamp: now,
                        token_info: swap.token1.clone(),
                        amount: swap.amount1,
                        swap_id: swap.id,
                        reason: PendingPaymentReason::Swap(accepted_by),
                    });
                    state.data.pending_payments_queue.push(PendingPayment {
                        principal: accepted_by,
                        timestamp: now,
                        token_info: swap.token0.clone(),
                        amount: swap.amount0,
                        swap_id: swap.id,
                        reason: PendingPaymentReason::Swap(swap.offered_by),
                    });
                    crate::jobs::make_pending_payments::start_job_if_required(state);
                }
                Success(SuccessResult { complete })
            }
        }),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    principal: Principal,
    ledger: CanisterId,
    account: Account,
    balance_required: u128,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let now = state.env.now();
    if let Some(swap) = state.data.swaps.get_mut(args.swap_id) {
        if swap.cancelled_at.is_some() {
            Err(SwapCancelled)
        } else if swap.expires_at < now {
            Err(SwapExpired)
        } else {
            let escrow_canister_id = state.env.canister_id();
            let principal = args.principal.unwrap_or_else(|| state.env.caller());

            if swap.offered_by == principal {
                if swap.token0_received {
                    Err(Success(SuccessResult {
                        complete: swap.token1_received,
                    }))
                } else {
                    Ok(PrepareResult {
                        principal,
                        ledger: swap.token0.ledger,
                        account: Account {
                            owner: escrow_canister_id,
                            subaccount: Some(deposit_subaccount(principal, swap.id)),
                        },
                        balance_required: swap.amount0 + swap.token0.fee,
                    })
                }
            } else if let Some((accepted_by, _)) = swap.accepted_by {
                if accepted_by == principal {
                    Err(Success(SuccessResult {
                        complete: swap.token0_received,
                    }))
                } else {
                    Err(SwapAlreadyAccepted)
                }
            } else if swap.restricted_to.is_none_or(|p| p == principal) {
                Ok(PrepareResult {
                    principal,
                    ledger: swap.token1.ledger,
                    account: Account {
                        owner: escrow_canister_id,
                        subaccount: Some(deposit_subaccount(principal, swap.id)),
                    },
                    balance_required: swap.amount1 + swap.token1.fee,
                })
            } else {
                Err(NotAuthorized)
            }
        }
    } else {
        Err(SwapNotFound)
    }
}
