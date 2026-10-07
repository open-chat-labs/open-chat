use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{
    bots::{BotAccessContext, extract_access_context_from_chat_context},
    mutate_state,
};
use canister_api_macros::update;
use local_user_index_canister::bot_delete_messages::*;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, ChannelId, Chat, MessageId, MessageIndex};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_delete_messages(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(error) => return error.into(),
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
        Chat::Channel(community_id, channel_id) => {
            let canister_id = CanisterId::from(community_id);
            let c2c_args = community_canister::c2c_bot_delete_messages::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                message_ids,
                thread,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_bot_delete_messages(canister_id, &c2c_args)
            })
            .await
            .into()
        }
        Chat::Group(chat_id) => {
            let canister_id = CanisterId::from(chat_id);
            let c2c_args = group_canister::c2c_bot_delete_messages::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                message_ids,
                thread,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                group_canister_c2c_client::c2c_bot_delete_messages(canister_id, &c2c_args)
            })
            .await
            .into()
        }
    }
}
