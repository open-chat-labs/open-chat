use canister_api_macros::update;
use local_user_index_canister::bot_create_channel::*;
use oc_error_codes::OCErrorCode;
use types::BotActionScope;

use crate::{bots::extract_access_context, mutate_state};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_create_channel(args: Args) -> Response {
    use Response::*;

    let context = match mutate_state(|state| extract_access_context(&args.auth_token, state)) {
        Ok(context) => context,
        Err(_) => return Error(OCErrorCode::BotNotAuthenticated.into()),
    };

    let BotActionScope::Community(details) = context.scope else {
        return Error(OCErrorCode::InvalidBotActionScope.with_message("Must be community scope"));
    };

    match community_canister_c2c_client::c2c_bot_create_channel(
        details.community_id.into(),
        &community_canister::c2c_bot_create_channel::Args {
            bot_id: context.bot_id,
            initiator: context.initiator,
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            avatar: args.avatar,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            messages_visible_to_non_members: args.messages_visible_to_non_members,
            permissions: args.permissions,
            events_ttl: args.events_ttl,
            gate_config: args.gate_config,
            external_url: args.external_url,
        },
    )
    .await
    {
        Ok(response) => match response {
            community_canister::c2c_bot_create_channel::Response::Success(result) => Success(SuccessResult {
                channel_id: result.channel_id,
            }),
            community_canister::c2c_bot_create_channel::Response::Error(error) => Error(error),
        },
        Err(error) => Error(error.into()),
    }
}
