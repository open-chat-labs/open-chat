use crate::guards::caller_is_owner;
use crate::model::p2p_trades::{P2PTradeOffer, P2PTradeOfferStatus};
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use types::{
    AcceptSwapSuccess, CanisterId, Chat, EventIndex, ReserveP2PTradeResult, ReserveP2PTradeSuccess, TimestampMillis,
    TransactionId, UserId,
};
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
        Err(response) => return *response,
    };

    let content = reserve_success.content;
    let transfer_result = match icrc_ledger_canister_c2c_client::icrc1_transfer(
        content.token1.ledger,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, content.offer_id)),
            },
            fee: Some(content.token1.fee.into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
            memo: None,
            amount: (content.token1_amount + content.token1.fee).into(),
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
            let token1_txn_in = TransactionId { index, hash: None };
            mutate_state(|state| {
                state.data.p2p_trades.add(P2PTradeOffer {
                    id: content.offer_id,
                    chat: Chat::Direct(args.user_id.into()),
                    created_by: reserve_success.created_by,
                    created: reserve_success.created,
                    status: P2PTradeOfferStatus::Accepted,
                    last_updated: state.env.now(),
                    token0: content.token0,
                    token0_amount: content.token0_amount,
                    token0_txn_in: Some(content.token0_txn_in),
                    token1: content.token1,
                    token1_amount: content.token1_amount,
                    token1_txn_in: Some(token1_txn_in),
                    expires_at: content.expires_at,
                });
            });
            NotifyEscrowCanisterOfDepositJob::run(content.offer_id);
            Success(AcceptSwapSuccess { token1_txn_in })
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
    reserve_success: ReserveP2PTradeSuccess,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        match chat
            .events
            .reserve_p2p_trade(my_user_id, None, args.message_id, EventIndex::default(), now)
        {
            ReserveP2PTradeResult::Success(reserve_success) => Ok(PrepareResult {
                my_user_id,
                escrow_canister_id: state.data.escrow_canister_id,
                reserve_success,
                now,
            }),
            ReserveP2PTradeResult::Failure(status) => Err(Box::new(StatusError(status.into()))),
            ReserveP2PTradeResult::OfferNotFound => Err(Box::new(OfferNotFound)),
        }
    } else {
        Err(Box::new(ChatNotFound))
    }
}
