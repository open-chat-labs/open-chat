use crate::crypto::process_transaction;
use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::TipMessageResult;
use ic_cdk_macros::update;
use types::{Chat, ChatId, CompletedCryptoTransaction, EventIndex, MessageId, MessageIndex, UserId};
use user_canister::tip_message::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn tip_message(args: Args) -> Response {
    run_regular_jobs();

    let message_sender = match read_state(|state| prepare(&args, state)) {
        Ok(user_id) => user_id,
        Err(response) => return *response,
    };

    // Make the crypto transfer
    let transfer = match process_transaction(args.transfer).await {
        Ok(completed) => completed,
        Err(failed) => return TransferFailed(failed.error_message().to_string()),
    };

    match args.chat {
        Chat::Direct(chat_id) => mutate_state(|state| {
            tip_direct_chat_message(chat_id, args.thread_root_message_index, args.message_id, transfer, state)
        }),
        Chat::Group(chat_id) => {
            use group_canister::c2c_tip_message::Response;
            let args = group_canister::c2c_tip_message::Args {
                message_sender,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                transfer,
            };
            match group_canister_c2c_client::c2c_tip_message(chat_id.into(), &args).await {
                Ok(Response::Success) => Success,
                Ok(Response::MessageNotFound) => MessageNotFound,
                Ok(Response::CannotTipSelf) => CannotTipSelf,
                Ok(Response::MessageSenderMismatch) => TransferNotToMessageSender,
                Ok(Response::NotAuthorized) => NotAuthorized,
                Ok(Response::GroupFrozen) => ChatFrozen,
                Ok(Response::UserNotInGroup) => ChatNotFound,
                Ok(Response::UserSuspended) => UserSuspended,
                Err(error) => InternalError(format!("{error:?}"), Box::new(args.transfer)),
            }
        }
        Chat::Channel(community_id, channel_id) => {
            use community_canister::c2c_tip_message::Response;
            let args = community_canister::c2c_tip_message::Args {
                message_sender,
                channel_id,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message_id,
                transfer,
            };
            match community_canister_c2c_client::c2c_tip_message(community_id.into(), &args).await {
                Ok(Response::Success) => Success,
                Ok(Response::MessageNotFound) => MessageNotFound,
                Ok(Response::CannotTipSelf) => CannotTipSelf,
                Ok(Response::MessageSenderMismatch) => TransferNotToMessageSender,
                Ok(Response::NotAuthorized) => NotAuthorized,
                Ok(Response::CommunityFrozen) => ChatFrozen,
                Ok(Response::UserSuspended) => UserSuspended,
                Ok(Response::UserNotInCommunity | Response::ChannelNotFound) => ChatNotFound,
                Err(error) => InternalError(format!("{error:?}"), Box::new(args.transfer)),
            }
        }
    }
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<UserId, Box<Response>> {
    if args.transfer.is_zero() {
        return Err(Box::new(TransferCannotBeZero));
    }

    let recipient = match args.transfer.user_id() {
        Some(u) => u,
        None => return Err(Box::new(TransferNotToMessageSender)),
    };

    let my_user_id: UserId = state.env.canister_id().into();
    if my_user_id == recipient {
        return Err(Box::new(CannotTipSelf));
    }

    if !match &args.chat {
        Chat::Direct(d) => state.data.direct_chats.has(d),
        Chat::Group(g) => state.data.group_chats.has(g),
        Chat::Channel(c, _) => state.data.communities.has(c),
    } {
        return Err(Box::new(ChatNotFound));
    }

    if state.data.suspended.value {
        Err(Box::new(UserSuspended))
    } else if args.transfer.is_zero() {
        Err(Box::new(TransferCannotBeZero))
    } else {
        Ok(recipient)
    }
}

fn tip_direct_chat_message(
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    transfer: CompletedCryptoTransaction,
    state: &mut RuntimeState,
) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&chat_id) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        match chat.events.tip_message(
            my_user_id,
            chat.them,
            EventIndex::default(),
            thread_root_message_index,
            message_id,
            transfer.clone(),
            now,
        ) {
            TipMessageResult::Success => {
                let c2c_args = user_canister::c2c_tip_message::Args {
                    thread_root_message_index,
                    message_id,
                    transfer,
                };
                state.data.fire_and_forget_handler.send(
                    chat_id.into(),
                    "c2c_tip_message_msgpack".to_string(),
                    msgpack::serialize_then_unwrap(c2c_args),
                );
                Success
            }
            TipMessageResult::MessageNotFound => MessageNotFound,
            TipMessageResult::CannotTipSelf => CannotTipSelf,
            TipMessageResult::MessageSenderMismatch => TransferNotToMessageSender,
        }
    } else {
        ChatNotFound
    }
}
