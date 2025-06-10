use crate::{
    bots::{BotAccessContext, extract_access_context_from_chat_context},
    mutate_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_delete_messages_v2::*;
use oc_error_codes::OCErrorCode;
use types::{ChannelId, Chat, MessageId, MessageIndex};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_messages_v2(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    call_chat_canister(context, None, args.thread, args.message_ids).await
}

async fn call_chat_canister(
    context: BotAccessContext,
    channel_id: Option<ChannelId>,
    thread: Option<MessageIndex>,
    message_ids: Vec<MessageId>,
) -> Response {
    let Some(chat) = context.scope.chat(channel_id) else {
        return OCErrorCode::InvalidBotActionScope
            .with_message("Channel not specified")
            .into();
    };

    let thread = thread.or(context.scope.thread());

    match chat {
        Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
            .with_message("Direct chats not supported")
            .into(),
        Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_delete_messages(
            community_id.into(),
            &community_canister::c2c_bot_delete_messages::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                message_ids,
                thread,
            },
        )
        .await
        .into(),
        Chat::Group(chat_id) => group_canister_c2c_client::c2c_bot_delete_messages(
            chat_id.into(),
            &group_canister::c2c_bot_delete_messages::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                message_ids,
                thread,
            },
        )
        .await
        .into(),
    }
}
