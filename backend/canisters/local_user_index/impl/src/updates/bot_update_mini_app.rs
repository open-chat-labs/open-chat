use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{bots::extract_access_context_from_chat_context, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::bot_update_mini_app::*;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, Chat};

// A bot changes what its MiniApp card shows as its game goes on, in a group or channel. It needs no
// permission beyond being installed there: the group or community checks the card is the bot's own.
#[update(candid = true, msgpack = true)]
async fn bot_update_mini_app(args: Args) -> Response {
    let context = match mutate_state(|state| extract_access_context_from_chat_context(args.chat_context, state)) {
        Ok(context) => context,
        Err(error) => return Response::Error(error),
    };

    let Some(chat) = context.scope.chat(None) else {
        return OCErrorCode::InvalidBotActionScope
            .with_message("Channel not specified")
            .into();
    };

    let thread = args.thread.or(context.scope.thread());

    match chat {
        Chat::Direct(_) => OCErrorCode::InvalidBotActionScope
            .with_message("Direct chats not supported")
            .into(),
        Chat::Channel(community_id, channel_id) => {
            let canister_id = CanisterId::from(community_id);
            let c2c_args = community_canister::c2c_bot_update_mini_app::Args {
                bot_id: context.bot_id,
                channel_id,
                thread,
                message_id: args.message_id,
                update: args.update,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_bot_update_mini_app(canister_id, &c2c_args)
            })
            .await
            .into()
        }
        Chat::Group(chat_id) => {
            let canister_id = CanisterId::from(chat_id);
            let c2c_args = group_canister::c2c_bot_update_mini_app::Args {
                bot_id: context.bot_id,
                thread,
                message_id: args.message_id,
                update: args.update,
            };
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                group_canister_c2c_client::c2c_bot_update_mini_app(canister_id, &c2c_args)
            })
            .await
            .into()
        }
    }
}
