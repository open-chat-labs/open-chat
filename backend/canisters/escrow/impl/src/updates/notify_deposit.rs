use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use escrow_canister::notify_deposit::{Response::*, *};
use icrc_ledger_types::icrc1::account::Account;
use types::{CanisterId, UserId};

#[update_msgpack]
#[trace]
async fn notify_deposit(args: Args) -> Response {
    let PrepareResult {
        user_id,
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
            let offer = state.data.offers.get_mut(args.offer_id).unwrap();
            if balance < balance_required {
                BalanceTooLow(BalanceTooLowResult {
                    balance,
                    balance_required,
                })
            } else {
                let now = state.env.now();
                if user_id == offer.created_by {
                    offer.token0_received = true;
                } else {
                    offer.accepted_by = Some((user_id, now));
                    offer.token1_received = true;
                }
                if offer.token0_received && offer.token1_received {
                    let accepted_by = offer.accepted_by.unwrap().0;
                    state.data.pending_payments_queue.push(PendingPayment {
                        user_id: offer.created_by,
                        timestamp: now,
                        token_info: offer.token1.clone(),
                        amount: offer.amount1,
                        offer_id: offer.id,
                        reason: PendingPaymentReason::Trade(accepted_by),
                    });
                    state.data.pending_payments_queue.push(PendingPayment {
                        user_id: accepted_by,
                        timestamp: now,
                        token_info: offer.token0.clone(),
                        amount: offer.amount0,
                        offer_id: offer.id,
                        reason: PendingPaymentReason::Trade(offer.created_by),
                    });
                    crate::jobs::make_pending_payments::start_job_if_required(state);
                }
                Success
            }
        }),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    user_id: UserId,
    ledger: CanisterId,
    account: Account,
    balance_required: u128,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    let now = state.env.now();
    if let Some(offer) = state.data.offers.get_mut(args.offer_id) {
        if offer.cancelled_at.is_some() {
            Err(OfferCancelled)
        } else if offer.expires_at < now {
            Err(OfferExpired)
        } else {
            let user_id = args.user_id.unwrap_or_else(|| state.env.caller().into());

            if offer.created_by == user_id {
                if offer.token0_received {
                    Err(Success)
                } else {
                    Ok(PrepareResult {
                        user_id,
                        ledger: offer.token0.ledger,
                        account: Account {
                            owner: state.env.canister_id(),
                            subaccount: Some(deposit_subaccount(user_id, offer.id)),
                        },
                        balance_required: offer.amount0 + offer.token0.fee,
                    })
                }
            } else if let Some((accepted_by, _)) = offer.accepted_by {
                if accepted_by == user_id {
                    Err(Success)
                } else {
                    Err(OfferAlreadyAccepted)
                }
            } else {
                Ok(PrepareResult {
                    user_id,
                    ledger: offer.token1.ledger,
                    account: Account {
                        owner: state.env.canister_id(),
                        subaccount: Some(deposit_subaccount(user_id, offer.id)),
                    },
                    balance_required: offer.amount1 + offer.token1.fee,
                })
            }
        }
    } else {
        Err(OfferNotFound)
    }
}
