use canister_api_macros::update;
use jwt::Claims;
use local_user_index_canister::bot_api_key::*;
use types::{BotActionByCommandClaims, BotActionScope, Chat};

use crate::{read_state, RuntimeState};

#[update(candid = true, json = true, msgpack = true)]
async fn bot_api_key(args: Args) -> Response {
    use Response::*;

    let Ok(claims) = read_state(|state| extract_access_context(&args.jwt, state)) else {
        unimplemented!()
    };

    let response = match claims.scope {
        BotActionScope::Chat(details) => match details.chat {
            Chat::Channel(community_id, channel_id) => {
                community_canister_c2c_client::c2c_bot_api_key(
                    community_id.into(),
                    &community_canister::c2c_bot_api_key::Args {
                        bot_id: claims.bot,
                        initiator: claims.command.initiator,
                        channel_id: Some(channel_id),
                    },
                )
                .await
            }
            Chat::Group(chat_id) => {
                group_canister_c2c_client::c2c_bot_api_key(
                    chat_id.into(),
                    &group_canister::c2c_bot_api_key::Args {
                        bot_id: claims.bot,
                        initiator: claims.command.initiator,
                    },
                )
                .await
            }
            Chat::Direct(_) => unimplemented!("Direct chat not supported in this branch"),
        },
        BotActionScope::Community(details) => {
            community_canister_c2c_client::c2c_bot_api_key(
                details.community_id.into(),
                &community_canister::c2c_bot_api_key::Args {
                    bot_id: claims.bot,
                    initiator: claims.command.initiator,
                    channel_id: None,
                },
            )
            .await
        }
    };

    match response {
        Ok(types::c2c_bot_api_key::Response::Success(api_key)) => Success(api_key),
        Ok(types::c2c_bot_api_key::Response::NotFound) => NotAuthorized,
        Ok(types::c2c_bot_api_key::Response::NotAuthorized) => NotAuthorized,
        Err((code, message)) => C2CError(code as i32, message),
    }
}

fn extract_access_context(jwt: &str, state: &RuntimeState) -> Result<BotActionByCommandClaims, Response> {
    use Response::*;

    let caller = state.env.caller();

    let Some(bot) = state.data.bots.get_by_caller(&caller) else {
        return Err(NotAuthorized);
    };

    let claims: Claims<BotActionByCommandClaims> = jwt::verify_and_decode(jwt, state.data.oc_key_pair.public_key_pem())
        .map_err(|error| FailedAuthentication(error.to_string()))?;

    if claims.exp_ms() < state.env.now() {
        return Err(FailedAuthentication("Token has expired".to_string()));
    }

    let claims = claims.into_custom();

    if claims.bot != bot.user_id {
        return Err(FailedAuthentication("Token does not match bot".to_string()));
    }

    Ok(claims)
}
