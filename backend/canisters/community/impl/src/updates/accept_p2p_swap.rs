use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::accept_p2p_swap::{Response::*, *};
use icrc_ledger_types::icrc1::transfer::TransferError;
use types::{AcceptSwapSuccess, Achievement, ChannelId, Chat, EventIndex, MessageId, MessageIndex, P2PSwapLocation, UserId};
use user_canister::{CommunityCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
async fn accept_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    let channel_id = args.channel_id;
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
                channel_id,
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

                if let Some(channel) = state.data.channels.get(&channel_id) {
                    if let Some((message, event_index)) = channel.chat.events.message_internal(
                        EventIndex::default(),
                        thread_root_message_index,
                        message_id.into(),
                    ) {
                        if channel
                            .chat
                            .members
                            .get(&message.sender)
                            .map_or(false, |m| !m.user_type().is_bot())
                        {
                            let community_id = state.env.canister_id().into();

                            state.data.user_event_sync_queue.push(
                                message.sender,
                                CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                                    chat: Chat::Channel(community_id, channel.id),
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
        mutate_state(|state| rollback(channel_id, user_id, thread_root_message_index, message_id, state));
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
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended().value {
            return Err(Box::new(UserSuspended));
        } else if member.lapsed().value {
            return Err(Box::new(UserLapsed));
        }
        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let channel_member = match channel.chat.members.get(&user_id) {
                Some(m) => m,
                _ => return Err(Box::new(UserNotInChannel)),
            };

            if channel_member.lapsed().value {
                return Err(Box::new(UserLapsed));
            }

            let now = state.env.now();

            match channel.chat.events.reserve_p2p_swap(
                user_id,
                args.thread_root_message_index,
                args.message_id,
                channel_member.min_visible_event_index(),
                now,
            ) {
                types::ReserveP2PSwapResult::Success(result) => {
                    handle_activity_notification(state);

                    Ok(ReserveP2PSwapResult {
                        user_id,
                        c2c_args: user_canister::c2c_accept_p2p_swap::Args {
                            swap_id: result.content.swap_id,
                            location: P2PSwapLocation::from_message(
                                Chat::Channel(caller.into(), args.channel_id),
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
            Err(Box::new(UserNotInChannel))
        }
    } else {
        Err(Box::new(UserNotInCommunity))
    }
}

fn rollback(
    channel_id: ChannelId,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    state: &mut RuntimeState,
) {
    if let Some(channel) = state.data.channels.get_mut(&channel_id) {
        channel
            .chat
            .events
            .unreserve_p2p_swap(user_id, thread_root_message_index, message_id, state.env.now());
    }
}
