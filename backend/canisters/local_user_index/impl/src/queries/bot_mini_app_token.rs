use crate::mini_app::sign_token;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::bot_mini_app_token::{Response::*, *};
use types::{CLAIM_TYPE_MINI_APP_BOT, MiniAppBotClaims};

// A token which says which bot is calling the MiniApp service
#[query(candid = true, msgpack = true)]
#[trace]
fn bot_mini_app_token(_args: Args) -> Response {
    mutate_state(bot_mini_app_token_impl)
}

fn bot_mini_app_token_impl(state: &mut RuntimeState) -> Response {
    let Some(bot_id) = state.data.bots.get_by_caller(&state.env.caller()).map(|bot| bot.bot_id) else {
        return NotAuthorized;
    };

    match sign_token(CLAIM_TYPE_MINI_APP_BOT, MiniAppBotClaims { bot: bot_id }, state) {
        Ok(token) => Success(token),
        Err(error) => InternalError(error),
    }
}
