use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ReserveP2PTradeResult;
use group_canister::accept_p2p_trade_offer::{Response::*, *};
use ic_cdk_macros::update;
use icrc_ledger_types::icrc1::transfer::TransferError;
use types::{MessageIndex, UserId};

#[update]
#[trace]
async fn accept_p2p_trade_offer(args: Args) -> Response {
    run_regular_jobs();

    let ReserveP2PTradeOfferResult { user_id, c2c_args } = match mutate_state(|state| reserve_p2p_trade_offer(&args, state)) {
        Ok(result) => result,
        Err(response) => return response,
    };

    let result = match user_canister_c2c_client::c2c_accept_p2p_trade_offer(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_accept_p2p_trade_offer::Response::Success(transaction_index)) => {
            mutate_state(|state| {
                state.data.chat.events.complete_p2p_trade(
                    user_id,
                    args.thread_root_message_index,
                    args.message_index,
                    transaction_index,
                    state.env.now(),
                )
            });
            Success
        }
        Ok(user_canister::c2c_accept_p2p_trade_offer::Response::TransferError(TransferError::InsufficientFunds { .. })) => {
            InsufficientFunds
        }
        Ok(response) => InternalError(format!("{response:?}")),
        Err(error) => InternalError(format!("{error:?}")),
    };

    if !matches!(result, Success) {
        mutate_state(|state| rollback(user_id, args.thread_root_message_index, args.message_index, state));
    }

    result
}

struct ReserveP2PTradeOfferResult {
    user_id: UserId,
    c2c_args: user_canister::c2c_accept_p2p_trade_offer::Args,
}

fn reserve_p2p_trade_offer(args: &Args, state: &mut RuntimeState) -> Result<ReserveP2PTradeOfferResult, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        let user_id = member.user_id;
        let min_visible_event_index = member.min_visible_event_index();
        let now = state.env.now();

        match state.data.chat.events.reserve_p2p_trade(
            user_id,
            args.thread_root_message_index,
            args.message_index,
            min_visible_event_index,
            now,
        ) {
            ReserveP2PTradeResult::Success(result) => {
                handle_activity_notification(state);

                Ok(ReserveP2PTradeOfferResult {
                    user_id,
                    c2c_args: user_canister::c2c_accept_p2p_trade_offer::Args {
                        offer_id: result.offer_id,
                        created: result.created,
                        created_by: result.created_by,
                        input_token: result.input_token,
                        input_amount: result.input_amount,
                        input_transaction_index: result.input_transaction_index,
                        output_token: result.output_token,
                        output_amount: result.output_amount,
                        expires_at: result.expires_at,
                    },
                })
            }
            ReserveP2PTradeResult::Cancelled => Err(OfferCancelled),
            ReserveP2PTradeResult::Expired => Err(OfferExpired),
            ReserveP2PTradeResult::AlreadyReserved(_) => Err(AlreadyAccepted),
            ReserveP2PTradeResult::AlreadyCompleted(_) => Err(AlreadyCompleted),
            ReserveP2PTradeResult::OfferNotFound => Err(OfferNotFound),
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn rollback(
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
    state: &mut RuntimeState,
) {
    state
        .data
        .chat
        .events
        .unreserve_p2p_trade(user_id, thread_root_message_index, message_index, state.env.now());
}
