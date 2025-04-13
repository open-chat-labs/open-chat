use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::accept_p2p_swap::{Response::*, *};
use icrc_ledger_types::icrc1::transfer::TransferError;
use oc_error_codes::OCErrorCode;
use types::{
    AcceptSwapSuccess, Achievement, ChannelId, Chat, EventIndex, MessageId, MessageIndex, OCResult, P2PSwapLocation, UserId,
};
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
        Err(response) => return Error(response),
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
                let now = state.env.now();
                if new_achievement {
                    state.notify_user_of_achievement(user_id, Achievement::AcceptedP2PSwapOffer, now);
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
                            .is_some_and(|m| !m.user_type().is_bot())
                        {
                            let community_id = state.env.canister_id().into();

                            state.push_event_to_user(
                                message.sender,
                                CommunityCanisterEvent::MessageActivity(MessageActivityEvent {
                                    chat: Chat::Channel(community_id, channel.id),
                                    thread_root_message_index,
                                    message_index: message.message_index,
                                    message_id: message.message_id,
                                    event_index,
                                    activity: MessageActivity::P2PSwapAccepted,
                                    timestamp: now,
                                    user_id: Some(user_id),
                                }),
                                now,
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
            Error(OCErrorCode::InsufficientFunds.into())
        }
        Ok(response) => Error(OCErrorCode::Unknown.with_message(format!("{response:?}"))),
        Err(error) => Error(error.into()),
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

fn reserve_p2p_swap(args: Args, state: &mut RuntimeState) -> OCResult<ReserveP2PSwapResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_and_verify_calling_member()?;
    let user_id = member.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let result = channel
        .chat
        .reserve_p2p_swap(user_id, args.thread_root_message_index, args.message_id, now)?;

    handle_activity_notification(state);

    Ok(ReserveP2PSwapResult {
        user_id,
        c2c_args: user_canister::c2c_accept_p2p_swap::Args {
            swap_id: result.content.swap_id,
            location: P2PSwapLocation::from_message(
                Chat::Channel(state.env.canister_id().into(), args.channel_id),
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
