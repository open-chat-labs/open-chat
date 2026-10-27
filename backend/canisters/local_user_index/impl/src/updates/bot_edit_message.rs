use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{bots::extract_access_context_from_chat_context, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::bot_edit_message::*;
use oc_error_codes::OCErrorCode;
use types::{BotInitiator, CanisterId, Chat};

// A bot edits its own messages autonomously, in a group or channel, eg. a bridge bot relaying the
// edits made on the other platform. The group or community checks the message is the bot's own.
#[update(candid = true, msgpack = true)]
async fn bot_edit_message(args: Args) -> Response {
    let context = match mutate_state(|state| {
        let context = extract_access_context_from_chat_context(args.chat_context, state)?;
        if !matches!(context.initiator, BotInitiator::Autonomous) {
            return Err(OCErrorCode::InvalidRequest.with_message("Bots must edit their messages autonomously"));
        }
        Ok(context)
    }) {
        Ok(context) => context,
        Err(error) => return Response::Error(error),
    };

    let Some(chat) = context.scope.chat(None) else {
        return OCErrorCode::InvalidBotActionScope
            .with_message("Channel not specified")
            .into();
    };

    let thread = args.thread.or(context.scope.thread());
    let og_previews = args.og_previews.unwrap_or_default();

    match chat {
        Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
            .with_message("Direct chats not supported")
            .into(),
        Chat::Channel(community_id, channel_id) => {
            let canister_id = CanisterId::from(community_id);
            let c2c_args = community_canister::c2c_bot_edit_message::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                channel_id,
                thread,
                message_id: args.message_id,
                content: args.content,
                block_level_markdown: args.block_level_markdown,
                og_previews,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_bot_edit_message(canister_id, &c2c_args)
            })
            .await
            .into()
        }
        Chat::Group(chat_id) => {
            let canister_id = CanisterId::from(chat_id);
            let c2c_args = group_canister::c2c_bot_edit_message::Args {
                bot_id: context.bot_id,
                initiator: context.initiator,
                thread,
                message_id: args.message_id,
                content: args.content,
                block_level_markdown: args.block_level_markdown,
                og_previews,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                group_canister_c2c_client::c2c_bot_edit_message(canister_id, &c2c_args)
            })
            .await
            .into()
        }
    }
}
