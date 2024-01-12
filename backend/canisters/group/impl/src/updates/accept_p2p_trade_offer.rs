use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::accept_p2p_trade_offer::{Response::*, *};
use ic_cdk_macros::update;
use icrc_ledger_types::icrc1::transfer::TransferError;
use types::{AcceptSwapSuccess, Chat, MessageId, MessageIndex, ReserveP2PTradeResult, UserId};

#[update]
#[trace]
async fn accept_p2p_trade_offer(args: Args) -> Response {
    run_regular_jobs();

    let ReserveP2PTradeOfferResult { user_id, c2c_args } = match mutate_state(|state| reserve_p2p_trade_offer(&args, state)) {
        Ok(result) => result,
        Err(response) => return *response,
    };

    let result = match user_canister_c2c_client::c2c_accept_p2p_trade_offer(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_accept_p2p_trade_offer::Response::Success(transaction_id)) => {
            NotifyEscrowCanisterOfDepositJob::run(
                user_id,
                c2c_args.offer_id,
                args.thread_root_message_index,
                args.message_id,
                transaction_id,
            );
            Success(AcceptSwapSuccess {
                token1_txn_in: transaction_id,
            })
        }
        Ok(user_canister::c2c_accept_p2p_trade_offer::Response::TransferError(TransferError::InsufficientFunds { .. })) => {
            InsufficientFunds
        }
        Ok(response) => InternalError(format!("{response:?}")),
        Err(error) => InternalError(format!("{error:?}")),
    };

    if !matches!(result, Success(_)) {
        mutate_state(|state| rollback(user_id, args.thread_root_message_index, args.message_id, state));
    }

    result
}

struct ReserveP2PTradeOfferResult {
    user_id: UserId,
    c2c_args: user_canister::c2c_accept_p2p_trade_offer::Args,
}

fn reserve_p2p_trade_offer(args: &Args, state: &mut RuntimeState) -> Result<ReserveP2PTradeOfferResult, Box<Response>> {
    if state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return Err(Box::new(UserSuspended));
        }

        let user_id = member.user_id;
        let min_visible_event_index = member.min_visible_event_index();
        let now = state.env.now();

        match state.data.chat.events.reserve_p2p_trade(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            min_visible_event_index,
            now,
        ) {
            ReserveP2PTradeResult::Success(result) => {
                handle_activity_notification(state);

                Ok(ReserveP2PTradeOfferResult {
                    user_id,
                    c2c_args: user_canister::c2c_accept_p2p_trade_offer::Args {
                        offer_id: result.content.offer_id,
                        chat: Chat::Group(state.env.canister_id().into()),
                        created: result.created,
                        created_by: result.created_by,
                        token0: result.content.token0,
                        token0_amount: result.content.token0_amount,
                        token0_txn_in: result.content.token0_txn_in,
                        token1: result.content.token1,
                        token1_amount: result.content.token1_amount,
                        expires_at: result.content.expires_at,
                    },
                })
            }
            ReserveP2PTradeResult::Failure(status) => Err(Box::new(StatusError(status.into()))),
            ReserveP2PTradeResult::OfferNotFound => Err(Box::new(OfferNotFound)),
        }
    } else {
        Err(Box::new(UserNotInGroup))
    }
}

fn rollback(user_id: UserId, thread_root_message_index: Option<MessageIndex>, message_id: MessageId, state: &mut RuntimeState) {
    state
        .data
        .chat
        .events
        .unreserve_p2p_trade(user_id, thread_root_message_index, message_id, state.env.now());
}
