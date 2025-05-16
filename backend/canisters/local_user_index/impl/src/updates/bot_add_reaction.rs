use crate::{
    bots::{BotAccessContext, extract_access_context, extract_access_context_from_chat_context},
    mutate_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_add_reaction::*;
use local_user_index_canister::bot_add_reaction_v2::Args as ArgsV2;
use oc_error_codes::OCErrorCode;
use types::{ChannelId, Chat, MessageId, MessageIndex, Reaction};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_add_reaction(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    call_chat_canister(context, args.channel_id, args.message_id, args.thread, args.reaction).await
}

#[update(candid = true, json = true, msgpack = true)]
async fn bot_add_reaction_v2(args: ArgsV2) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(_) => return OCErrorCode::BotNotAuthenticated.into(),
    };

    call_chat_canister(context, None, args.message_id, args.thread, args.reaction).await
}

async fn call_chat_canister(
    context: BotAccessContext,
    channel_id: Option<ChannelId>,
    message_id: MessageId,
    thread: Option<MessageIndex>,
    reaction: Reaction,
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
        Chat::Channel(community_id, channel_id) => community_canister_c2c_client::c2c_bot_add_reaction(
            community_id.into(),
            &community_canister::c2c_bot_add_reaction::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                message_id,
                thread,
                reaction,
                bot_name: context.bot_name,
            },
        )
        .await
        .into(),
        Chat::Group(chat_id) => group_canister_c2c_client::c2c_bot_add_reaction(
            chat_id.into(),
            &group_canister::c2c_bot_add_reaction::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                message_id,
                reaction,
                thread,
                bot_name: context.bot_name,
            },
        )
        .await
        .into(),
    }
}
