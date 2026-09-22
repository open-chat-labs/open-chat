use crate::guards::caller_is_owner;
use crate::timer_job_types::{NotifyEscrowCanisterOfDepositJob, SendMessageToChannelJob, SendMessageToGroupJob, TimerJob};
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::MessageContentInternal;
use constants::SECOND_IN_MS;
use oc_error_codes::OCError;
use types::{
    Achievement, C2CError, CanisterId, Chat, CompletedCryptoTransaction, MessageContentInitial, MessageId, MessageIndex,
    OCResult, PendingCryptoTransaction, PinNumberWrapper, TimestampMillis, UserId, icrc1,
};
use user_canister::send_message_with_transfer_to_channel;
use user_canister::send_message_with_transfer_to_group;
use user_core::updates::send_message_with_transfer::{Prepared, SetUpP2PSwapError, create_p2p_swap, p2p_swap_deposit};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_channel(
    args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    execute_update_async(|| send_message_with_transfer_to_channel_impl(args)).await
}

async fn send_message_with_transfer_to_channel_impl(
    args: send_message_with_transfer_to_channel::Args,
) -> send_message_with_transfer_to_channel::Response {
    use send_message_with_transfer_to_channel::Response::*;
    // Check that the user is a member of the community
    let (exists, now) = read_state(|state| (state.data.user.communities.exists(&args.community_id), state.env.now()));
    if !exists {
        return UserNotInCommunity(None);
    }

    let chat = Chat::Channel(args.community_id, args.channel_id);

    // Validate the content and extract the PendingCryptoTransaction
    let (pending_transaction, p2p_swap_id) = match mutate_state(|state| {
        prepare(
            chat,
            args.thread_root_message_index,
            args.message_id,
            &args.content,
            args.pin,
            now,
            state,
        )
    }) {
        Ok(Prepared::Transfer(t)) => (t, None),
        Ok(Prepared::P2PSwap(create_swap_args, from_account)) => {
            let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);
            match set_up_p2p_swap(escrow_canister_id, *create_swap_args, from_account).await {
                Ok((id, t)) => (t, Some(id)),
                Err(error) => return Error(error.into()),
            }
        }
        Err(error) => return Error(error),
    };

    // Make the crypto transfer
    let (content, completed_transaction) = match process_transaction(args.content, pending_transaction, p2p_swap_id, now).await
    {
        Ok(Ok((c, t))) => (c, t),
        Ok(Err(error)) => return Error(error),
        Err(error) => return Error(error.into()),
    };

    let achievement = content.content_type().achievement();
    let has_thread = args.thread_root_message_index.is_some();
    let quote_reply = args.replies_to.is_some();

    // Build the send_message args
    let c2c_args = community_canister::c2c_send_message::Args {
        channel_id: args.channel_id,
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        community_rules_accepted: args.community_rules_accepted,
        channel_rules_accepted: args.channel_rules_accepted,
        message_filter_failed: args.message_filter_failed,
        og_previews: args.og_previews,
        sender: None,
    };

    // Send the message to the community
    use community_canister::c2c_send_message::Response;
    match community_canister_c2c_client::c2c_send_message(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => {
                mutate_state(|state| award_achievements(achievement, r.message_index, has_thread, quote_reply, state));

                Success(send_message_with_transfer_to_channel::SuccessResult {
                    event_index: r.event_index,
                    message_index: r.message_index,
                    timestamp: r.timestamp,
                    expires_at: r.expires_at,
                    transfer: completed_transaction,
                })
            }
            Response::Error(error) => Error(error),
        },
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SendMessageToChannel(Box::new(SendMessageToChannelJob {
                        community_id: args.community_id,
                        args: c2c_args,
                        p2p_swap_id,
                        attempt: 0,
                    })),
                    now + 10 * SECOND_IN_MS,
                    now,
                );
            });
            Retrying(format!("{error:?}"), completed_transaction)
        }
    }
}

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn send_message_with_transfer_to_group(
    args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    execute_update_async(|| send_message_with_transfer_to_group_impl(args)).await
}

async fn send_message_with_transfer_to_group_impl(
    args: send_message_with_transfer_to_group::Args,
) -> send_message_with_transfer_to_group::Response {
    use send_message_with_transfer_to_group::Response::*;

    // Check that the user is a member of the group
    let (exists, now) = read_state(|state| (state.data.user.group_chats.exists(&args.group_id), state.env.now()));
    if !exists {
        return CallerNotInGroup(None);
    }

    let chat = Chat::Group(args.group_id);

    // Validate the content and extract the PendingCryptoTransaction
    let (pending_transaction, p2p_swap_id) = match mutate_state(|state| {
        prepare(
            chat,
            args.thread_root_message_index,
            args.message_id,
            &args.content,
            args.pin,
            now,
            state,
        )
    }) {
        Ok(Prepared::Transfer(t)) => (t, None),
        Ok(Prepared::P2PSwap(create_swap_args, from_account)) => {
            let escrow_canister_id = read_state(|state| state.data.escrow_canister_id);
            match set_up_p2p_swap(escrow_canister_id, *create_swap_args, from_account).await {
                Ok((id, t)) => (t, Some(id)),
                Err(error) => return Error(error.into()),
            }
        }
        Err(error) => return Error(error),
    };

    // Make the crypto transfer
    let (content, completed_transaction) = match process_transaction(args.content, pending_transaction, p2p_swap_id, now).await
    {
        Ok(Ok((c, t))) => (c, t),
        Ok(Err(error)) => return Error(error),
        Err(error) => return Error(error.into()),
    };

    let achievement = content.content_type().achievement();
    let has_thread = args.thread_root_message_index.is_some();
    let quote_reply = args.replies_to.is_some();

    // Build the send_message args
    let c2c_args = group_canister::c2c_send_message::Args {
        message_id: args.message_id,
        thread_root_message_index: args.thread_root_message_index,
        content,
        sender_name: args.sender_name,
        sender_display_name: args.sender_display_name,
        replies_to: args.replies_to,
        mentioned: args.mentioned,
        forwarding: false,
        block_level_markdown: args.block_level_markdown,
        rules_accepted: args.rules_accepted,
        message_filter_failed: args.message_filter_failed,
        og_previews: args.og_previews,
        sender: None,
    };

    // Send the message to the group
    use group_canister::c2c_send_message::Response;
    match group_canister_c2c_client::c2c_send_message(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            Response::Success(r) => {
                mutate_state(|state| award_achievements(achievement, r.message_index, has_thread, quote_reply, state));

                Success(send_message_with_transfer_to_group::SuccessResult {
                    event_index: r.event_index,
                    message_index: r.message_index,
                    timestamp: r.timestamp,
                    expires_at: r.expires_at,
                    transfer: completed_transaction,
                })
            }
            Response::Error(error) => Error(error),
        },
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SendMessageToGroup(Box::new(SendMessageToGroupJob {
                        chat_id: args.group_id,
                        args: c2c_args,
                        p2p_swap_id,
                        attempt: 0,
                    })),
                    now + 10 * SECOND_IN_MS,
                    now,
                );
            });
            Retrying(format!("{error:?}"), completed_transaction)
        }
    }
}

fn prepare(
    chat: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: &MessageContentInitial,
    pin: Option<PinNumberWrapper>,
    now: TimestampMillis,
    state: &mut RuntimeState,
) -> OCResult<Prepared> {
    let my_user_id = UserId::from(state.env.canister_id());
    user_core::updates::send_message_with_transfer::prepare(
        &mut state.data.user,
        my_user_id,
        chat,
        thread_root_message_index,
        message_id,
        content,
        pin,
        now,
    )
}

async fn process_transaction(
    content: MessageContentInitial,
    pending_transaction: PendingCryptoTransaction,
    p2p_swap_id: Option<u32>,
    now: TimestampMillis,
) -> Result<Result<(MessageContentInternal, CompletedCryptoTransaction), OCError>, C2CError> {
    match crate::crypto::process_transaction(pending_transaction).await {
        Ok(Ok(completed)) => {
            if let Some(id) = p2p_swap_id {
                let my_user_id = read_state(|state| UserId::from(state.env.canister_id()));
                NotifyEscrowCanisterOfDepositJob::run(id, my_user_id);
            }
            Ok(Ok((
                MessageContentInternal::new_with_transfer(content, completed.clone().into(), p2p_swap_id, now),
                completed,
            )))
        }
        Ok(Err((_, error))) => Ok(Err(error)),
        Err(error) => Err(error),
    }
}

// Creates the swap in the escrow canister and records it, returning its id and the deposit of
// token0 to make
pub(crate) async fn set_up_p2p_swap(
    escrow_canister_id: CanisterId,
    args: escrow_canister::create_swap::Args,
    from_account: Option<icrc1::Account>,
) -> Result<(u32, PendingCryptoTransaction), SetUpP2PSwapError> {
    let id = create_p2p_swap(escrow_canister_id, &args).await?;
    Ok(mutate_state(|state| {
        let my_user_id = UserId::from(state.env.canister_id());
        let now = state.env.now();
        let (swap, deposit) = p2p_swap_deposit(escrow_canister_id, my_user_id, id, args, from_account, now);
        state.data.user.p2p_swaps.add(swap);
        (id, deposit)
    }))
}

fn award_achievements(
    message_type_achievement: Option<Achievement>,
    message_index: MessageIndex,
    in_thread: bool,
    quote_reply: bool,
    state: &mut RuntimeState,
) {
    let achievements = user_core::updates::send_message_with_transfer::achievements(
        message_type_achievement,
        message_index,
        in_thread,
        quote_reply,
    );
    state.award_achievements_and_notify(achievements, state.env.now());
}
