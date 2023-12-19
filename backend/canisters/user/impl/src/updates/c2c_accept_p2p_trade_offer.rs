use crate::guards::caller_is_known_group_or_community_canister;
use crate::model::p2p_trades::{P2PTradeOffer, P2PTradeOfferStatus};
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use types::{CanisterId, TimestampMillis, UserId};
use user_canister::c2c_accept_p2p_trade_offer::{Response::*, *};
use utils::time::NANOS_PER_MILLISECOND;

#[update_msgpack(guard = "caller_is_known_group_or_community_canister")]
#[trace]
async fn c2c_accept_p2p_trade_offer(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        now,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match icrc_ledger_canister_c2c_client::icrc1_transfer(
        args.output_token.ledger,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, args.offer_id)),
            },
            fee: Some(args.output_token.fee.into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
            memo: None,
            amount: (args.output_amount + args.output_token.fee).into(),
        },
    )
    .await
    {
        Ok(Ok(index_nat)) => {
            let index = index_nat.0.try_into().unwrap();
            mutate_state(|state| {
                state.data.p2p_trades.add(P2PTradeOffer {
                    id: args.offer_id,
                    created_by: args.created_by,
                    created: args.created,
                    status: P2PTradeOfferStatus::Accepted,
                    last_updated: state.env.now(),
                    input_token: args.input_token,
                    input_amount: args.input_amount,
                    input_transaction_index: Some(args.input_transaction_index),
                    output_token: args.output_token,
                    output_amount: args.output_amount,
                    output_transaction_index: Some(index),
                    expires_at: args.expires_at,
                });
            });
            Success(index)
        }
        Ok(Err(error)) => TransferError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(offer) = state.data.p2p_trades.get(args.offer_id) {
        if let Some(index) = offer.output_transaction_index {
            return Err(Success(index));
        }
    }
    Ok(PrepareResult {
        my_user_id: state.env.canister_id().into(),
        escrow_canister_id: state.data.escrow_canister_id,
        now: state.env.now(),
    })
}
