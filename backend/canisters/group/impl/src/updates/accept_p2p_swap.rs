use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::accept_p2p_swap::{Response::*, *};
use icrc_ledger_types::icrc1::transfer::TransferError;
use types::{AcceptSwapSuccess, Achievement, Chat, EventIndex, MessageId, MessageIndex, P2PSwapLocation, UserId};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
async fn accept_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    let thread_root_message_index = args.thread_root_message_index;
    let message_id = args.message_id;
    let new_achievement = args.new_achievement;

    let ReserveP2PSwapResult { user_id, c2c_args } = match mutate_state(|state| reserve_p2p_swap(args, state)) {
        Ok(result) => result,
        Err(response) => return *response,
    };

    let result = match user_canister_c2c_client::c2c_accept_p2p_swap(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_accept_p2p_swap::Response::Success(transaction_index)) => {
            NotifyEscrowCanisterOfDepositJob::run(
                user_id,
                c2c_args.swap_id,
                thread_root_message_index,
                message_id,
                transaction_index,
            );

            mutate_state(|state| {
                if new_achievement {
                    state
                        .data
                        .notify_user_of_achievement(user_id, Achievement::AcceptedP2PSwapOffer);
                }

                if let Some((message, event_index)) =
                    state
                        .data
                        .chat
                        .events
                        .message_internal(EventIndex::default(), thread_root_message_index, message_id.into())
                {
                    if state
                        .data
                        .chat
                        .members
                        .get(&message.sender)
                        .map_or(false, |m| !m.user_type().is_bot())
                    {
                        state.data.user_event_sync_queue.push(
                            message.sender,
                            GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                                chat: Chat::Group(state.env.canister_id().into()),
                                thread_root_message_index,
                                message_index: message.message_index,
                                message_id: message.message_id,
                                event_index,
                                activity: MessageActivity::P2PSwapAccepted,
                                timestamp: state.env.now(),
                                user_id: Some(user_id),
                            }),
                        );
                    }
                }

                handle_activity_notification(state);
            });

            Success(AcceptSwapSuccess {
                token1_txn_in: transaction_index,
            })
        }
        Ok(user_canister::c2c_accept_p2p_swap::Response::TransferError(TransferError::InsufficientFunds { .. })) => {
            InsufficientFunds
        }
        Ok(user_canister::c2c_accept_p2p_swap::Response::PinRequired) => PinRequired,
        Ok(user_canister::c2c_accept_p2p_swap::Response::PinIncorrect(delay)) => PinIncorrect(delay),
        Ok(user_canister::c2c_accept_p2p_swap::Response::TooManyFailedPinAttempts(delay)) => TooManyFailedPinAttempts(delay),
        Ok(response) => InternalError(format!("{response:?}")),
        Err(error) => InternalError(format!("{error:?}")),
    };

    if !matches!(result, Success(_)) {
        mutate_state(|state| rollback(user_id, thread_root_message_index, message_id, state));
    }

    result
}

struct ReserveP2PSwapResult {
    user_id: UserId,
    c2c_args: user_canister::c2c_accept_p2p_swap::Args,
}

fn reserve_p2p_swap(args: Args, state: &mut RuntimeState) -> Result<ReserveP2PSwapResult, Box<Response>> {
    if state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return Err(Box::new(UserSuspended));
        } else if member.lapsed().value {
            return Err(Box::new(UserLapsed));
        }

        let user_id = member.user_id();
        let min_visible_event_index = member.min_visible_event_index();
        let now = state.env.now();

        match state.data.chat.events.reserve_p2p_swap(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            min_visible_event_index,
            now,
        ) {
            types::ReserveP2PSwapResult::Success(result) => {
                handle_activity_notification(state);

                Ok(ReserveP2PSwapResult {
                    user_id,
                    c2c_args: user_canister::c2c_accept_p2p_swap::Args {
                        swap_id: result.content.swap_id,
                        location: P2PSwapLocation::from_message(
                            Chat::Group(state.env.canister_id().into()),
                            args.thread_root_message_index,
                            args.message_id,
                        ),
                        created: result.created,
                        created_by: result.created_by,
                        token0: result.content.token0,
                        token0_amount: result.content.token0_amount,
                        token0_txn_in: result.content.token0_txn_in,
                        token1: result.content.token1,
                        token1_amount: result.content.token1_amount,
                        expires_at: result.content.expires_at,
                        pin: args.pin,
                    },
                })
            }
            types::ReserveP2PSwapResult::Failure(status) => Err(Box::new(StatusError(status.into()))),
            types::ReserveP2PSwapResult::SwapNotFound => Err(Box::new(SwapNotFound)),
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
        .unreserve_p2p_swap(user_id, thread_root_message_index, message_id, state.env.now());
}
