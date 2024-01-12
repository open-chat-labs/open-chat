use crate::guards::caller_is_owner;
use crate::model::p2p_trades::{P2PTradeOffer, P2PTradeOfferStatus};
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{ReserveP2PTradeOfferSuccess, ReserveP2PTradeResult};
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use types::{CanisterId, Chat, EventIndex, TimestampMillis, UserId};
use user_canister::accept_p2p_trade_offer::{Response::*, *};
use utils::time::NANOS_PER_MILLISECOND;

#[update_msgpack(guard = "caller_is_owner")]
#[trace]
async fn accept_p2p_trade_offer(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        reserve_success,
        now,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let transfer_result = match icrc_ledger_canister_c2c_client::icrc1_transfer(
        reserve_success.output_token.ledger,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, reserve_success.offer_id)),
            },
            fee: Some(reserve_success.output_token.fee.into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
            memo: None,
            amount: (reserve_success.output_amount + reserve_success.output_token.fee).into(),
        },
    )
    .await
    {
        Ok(Ok(index_nat)) => {
            let index: u64 = index_nat.0.try_into().unwrap();
            Ok(index)
        }
        Ok(Err(error)) => {
            if matches!(error, TransferError::InsufficientFunds { .. }) {
                Err(InsufficientFunds)
            } else {
                Err(InternalError(format!("{error:?}")))
            }
        }
        Err(error) => Err(InternalError(format!("{error:?}"))),
    };

    match transfer_result {
        Ok(index) => {
            mutate_state(|state| {
                state.data.p2p_trades.add(P2PTradeOffer {
                    id: reserve_success.offer_id,
                    chat: Chat::Direct(args.user_id.into()),
                    created_by: reserve_success.created_by,
                    created: reserve_success.created,
                    status: P2PTradeOfferStatus::Accepted,
                    last_updated: state.env.now(),
                    input_token: reserve_success.input_token,
                    input_amount: reserve_success.input_amount,
                    input_transaction_index: Some(reserve_success.input_transaction_index),
                    output_token: reserve_success.output_token,
                    output_amount: reserve_success.output_amount,
                    output_transaction_index: Some(index),
                    expires_at: reserve_success.expires_at,
                });
            });
            NotifyEscrowCanisterOfDepositJob::run(reserve_success.offer_id);
            Success(index)
        }
        Err(response) => {
            mutate_state(|state| {
                if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
                    let now = state.env.now();
                    chat.events.unreserve_p2p_trade(my_user_id, None, args.message_id, now);
                }
            });
            response
        }
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    reserve_success: ReserveP2PTradeOfferSuccess,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        match chat
            .events
            .reserve_p2p_trade(my_user_id, None, args.message_id, EventIndex::default(), now)
        {
            ReserveP2PTradeResult::Success(result) => Ok(PrepareResult {
                my_user_id,
                escrow_canister_id: state.data.escrow_canister_id,
                reserve_success: *result,
                now,
            }),
            ReserveP2PTradeResult::Cancelled => Err(OfferCancelled),
            ReserveP2PTradeResult::Expired => Err(OfferExpired),
            ReserveP2PTradeResult::AlreadyReserved(_) => Err(AlreadyAccepted),
            ReserveP2PTradeResult::AlreadyCompleted(_) => Err(AlreadyCompleted),
            ReserveP2PTradeResult::OfferNotFound => Err(OfferNotFound),
        }
    } else {
        Err(ChatNotFound)
    }
}
