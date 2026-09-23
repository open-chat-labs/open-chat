use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use escrow_canister::notify_deposit::{Response::*, *};
use icrc_ledger_types::icrc1::account::Account;
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

async fn process_swap(
    swap_id: u32,
    principal: Principal,
    token_info: TokenInfo,
    account: Account,
    balance_required: u128,
) -> Response {
    match icrc_ledger_canister_c2c_client::icrc1_balance_of(token_info.ledger, &account)
        .await
        .map(|b| u128::try_from(b.0).unwrap())
    {
        Ok(balance) => mutate_state(|state| {
            let swap = state.data.swaps.get_mut(swap_id).unwrap();
            if balance < balance_required {
                if balance > token_info.fee {
                    state.data.pending_payments_queue.push(PendingPayment {
                        principal,
                        timestamp: state.env.now(),
                        amount: balance - token_info.fee,
                        token_info,
                        swap_id,
                        reason: PendingPaymentReason::Refund,
                    });
                    crate::jobs::make_pending_payments::start_job_if_required(state);
                }
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

async fn check_for_refund(swap_id: u32, principal: Principal, token_info: TokenInfo, account: Account) -> Result<(), String> {
    match icrc_ledger_canister_c2c_client::icrc1_balance_of(token_info.ledger, &account)
        .await
        .map(|b| u128::try_from(b.0).unwrap())
    {
        Ok(balance) => {
            if balance > token_info.fee {
                mutate_state(|state| {
                    state.data.pending_payments_queue.push(PendingPayment {
                        principal,
                        timestamp: state.env.now(),
                        amount: balance - token_info.fee,
                        token_info,
                        swap_id,
                        reason: PendingPaymentReason::Refund,
                    });
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
    let expired = now > swap.expires_at;

    let principal = args.deposited_by.unwrap_or_else(|| state.env.caller());
    let escrow_canister_id = state.env.canister_id();

    if swap.offered_by == principal {
        let token_info = swap.token0.clone();
        let account = Account {
            owner: escrow_canister_id,
            subaccount: Some(deposit_subaccount(principal, swap.id)),
        };

        let response = if expired {
            SwapExpired
        } else if swap.cancelled_at.is_some() {
            SwapCancelled
        } else if swap.token0_received {
            Success(SuccessResult {
                complete: swap.token1_received,
            })
        } else {
            return PrepareResult::Success(PrepareSuccess {
                principal,
                account,
                balance_required: swap.amount0 + swap.token0.fee,
                token_info,
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

        let response = if expired {
            SwapExpired
        } else if swap.cancelled_at.is_some() {
            SwapCancelled
        } else if let Some((accepted_by, _)) = swap.accepted_by {
            if accepted_by == principal {
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
