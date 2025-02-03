use canister_api_macros::update;
use local_user_index_canister::bot_send_message::*;
use types::{
    BotActionScope, BotInitiator, BotMessageContent, ChannelId, Chat, ChatId, CommunityId, MessageId, MessageIndex, UserId,
};

use crate::{bots::extract_access_context, mutate_state};

#[update(candid = true)]
async fn bot_send_message(args: Args) -> Response {
    use Response::*;

    let context = match mutate_state(|state| extract_access_context(&args.access_token, state)) {
        Ok(context) => context,
        Err(error) => return InvalidRequest(error),
    };

    let BotActionScope::Chat(chat_details) = context.scope else {
        return InvalidRequest("Cannot send a message to community scope".to_string());
    };

    match chat_details.chat {
        Chat::Direct(_) => unreachable!(),
        Chat::Group(chat_id) => {
            send_message_to_group(
                context.bot_id,
                context.bot_name,
                context.initiator,
                chat_id,
                chat_details.thread_root_message_index,
                chat_details.message_id,
                args.content,
                args.block_level_markdown,
                args.finalised,
            )
            .await
        }
        Chat::Channel(community_id, channel_id) => {
            send_message_to_channel(
                context.bot_id,
                context.bot_name,
                context.initiator,
                community_id,
                channel_id,
                chat_details.thread_root_message_index,
                chat_details.message_id,
                args.content,
                args.block_level_markdown,
                args.finalised,
            )
            .await
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn send_message_to_channel(
    bot_id: UserId,
    bot_name: String,
    initiator: BotInitiator,
    community_id: CommunityId,
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: BotMessageContent,
    block_level_markdown: bool,
    finalised: bool,
) -> Response {
    use Response::*;

    match community_canister_c2c_client::c2c_bot_send_message(
        community_id.into(),
        &community_canister::c2c_bot_send_message::Args {
            bot_id,
            initiator,
            channel_id,
            thread_root_message_index,
            message_id,
            content,
            bot_name,
            block_level_markdown,
            finalised,
        },
    )
    .await
    {
        Ok(response) => match response {
            community_canister::c2c_bot_send_message::Response::Success(result) => Success(SuccessResult {
                message_id,
                event_index: result.event_index,
                message_index: result.message_index,
                timestamp: result.timestamp,
                expires_at: result.expires_at,
            }),
            community_canister::c2c_bot_send_message::Response::NotAuthorized => NotAuthorized,
            community_canister::c2c_bot_send_message::Response::CommunityFrozen => Frozen,
            community_canister::c2c_bot_send_message::Response::ChannelNotFound => {
                InvalidRequest("Channel not found".to_string())
            }
            community_canister::c2c_bot_send_message::Response::ThreadNotFound => ThreadNotFound,
            community_canister::c2c_bot_send_message::Response::InvalidRequest(message) => InvalidRequest(message),
            community_canister::c2c_bot_send_message::Response::MessageAlreadyFinalised => MessageAlreadyFinalised,
        },
        Err((code, message)) => C2CError(code as i32, message),
    }
}

#[allow(clippy::too_many_arguments)]
async fn send_message_to_group(
    bot_id: UserId,
    bot_name: String,
    initiator: BotInitiator,
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: BotMessageContent,
    block_level_markdown: bool,
    finalised: bool,
) -> Response {
    use Response::*;

    match group_canister_c2c_client::c2c_bot_send_message(
        chat_id.into(),
        &group_canister::c2c_bot_send_message::Args {
            bot_id,
            initiator,
            thread_root_message_index,
            message_id,
            content,
            bot_name,
            block_level_markdown,
            finalised,
        },
    )
    .await
    {
        Ok(response) => match response {
            group_canister::c2c_bot_send_message::Response::Success(result) => Success(SuccessResult {
                message_id,
                event_index: result.event_index,
                message_index: result.message_index,
                timestamp: result.timestamp,
                expires_at: result.expires_at,
            }),
            group_canister::c2c_bot_send_message::Response::NotAuthorized => NotAuthorized,
            group_canister::c2c_bot_send_message::Response::ChatFrozen => Frozen,
            group_canister::c2c_bot_send_message::Response::ThreadNotFound => ThreadNotFound,
            group_canister::c2c_bot_send_message::Response::InvalidRequest(message) => InvalidRequest(message),
            group_canister::c2c_bot_send_message::Response::MessageAlreadyFinalised => MessageAlreadyFinalised,
        },
        Err((code, message)) => C2CError(code as i32, message),
    }
}
