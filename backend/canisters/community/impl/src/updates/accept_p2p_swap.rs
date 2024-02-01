use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::accept_p2p_swap::{Response::*, *};
use ic_cdk_macros::update;
use icrc_ledger_types::icrc1::transfer::TransferError;
use types::{AcceptSwapSuccess, ChannelId, Chat, MessageId, MessageIndex, P2PSwapLocation, UserId};

#[update]
#[trace]
async fn accept_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    let ReserveP2PSwapResult { user_id, c2c_args } = match mutate_state(|state| reserve_p2p_swap(&args, state)) {
        Ok(result) => result,
        Err(response) => return *response,
    };

    let result = match user_canister_c2c_client::c2c_accept_p2p_swap(user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_accept_p2p_swap::Response::Success(transaction_index)) => {
            NotifyEscrowCanisterOfDepositJob::run(
                user_id,
                c2c_args.swap_id,
                args.channel_id,
                args.thread_root_message_index,
                args.message_id,
                transaction_index,
            );
            Success(AcceptSwapSuccess {
                token1_txn_in: transaction_index,
            })
        }
        Ok(user_canister::c2c_accept_p2p_swap::Response::TransferError(TransferError::InsufficientFunds { .. })) => {
            InsufficientFunds
        }
        Ok(response) => InternalError(format!("{response:?}")),
        Err(error) => InternalError(format!("{error:?}")),
    };

    if !matches!(result, Success(_)) {
        mutate_state(|state| {
            rollback(
                args.channel_id,
                user_id,
                args.thread_root_message_index,
                args.message_id,
                state,
            )
        });
    }

    result
}

struct ReserveP2PSwapResult {
    user_id: UserId,
    c2c_args: user_canister::c2c_accept_p2p_swap::Args,
}

fn reserve_p2p_swap(args: &Args, state: &mut RuntimeState) -> Result<ReserveP2PSwapResult, Box<Response>> {
    if state.data.is_frozen() {
        return Err(Box::new(ChatFrozen));
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return Err(Box::new(UserSuspended));
        }
        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
            let channel_member = match channel.chat.members.get(&user_id) {
                Some(m) => m,
                _ => return Err(Box::new(UserNotInChannel)),
            };
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
