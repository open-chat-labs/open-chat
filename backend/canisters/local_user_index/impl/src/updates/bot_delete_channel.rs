use canister_api_macros::update;
use local_user_index_canister::bot_delete_channel::*;
use types::BotActionScope;

use crate::{bots::extract_access_context, mutate_state};

#[update(candid = true)]
async fn bot_delete_channel(args: Args) -> Response {
    use Response::*;

    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(error) => return NotAuthenticated(error),
    };

    let BotActionScope::Community(details) = context.scope else {
        return InvalidRequest("Must be community scope".to_string());
    };

    match community_canister_c2c_client::c2c_bot_delete_channel(
        details.community_id.into(),
        &community_canister::c2c_bot_delete_channel::Args {
            channel_id: args.channel_id,
            bot_id: context.bot_id,
            initiator: context.initiator,
        },
    )
    .await
    {
        Ok(response) => match response {
            community_canister::c2c_bot_delete_channel::Response::Success => Success,
            community_canister::c2c_bot_delete_channel::Response::NotAuthorized => NotAuthorized,
            community_canister::c2c_bot_delete_channel::Response::CommunityFrozen => Frozen,
            community_canister::c2c_bot_delete_channel::Response::ChannelNotFound => ChannelNotFound,
        },
        Err((code, message)) => C2CError(code as i32, message),
    }
}
