use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::generate_bot_api_key::{Response::*, *};
use types::{AccessTokenScope, BotApiKeyToken, Chat};
use utils::base64;

#[update(msgpack = true)]
#[trace]
fn generate_bot_api_key(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| generate_bot_api_key_impl(args, state))
}

fn generate_bot_api_key_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return NotAuthorized;
    }

    if state.data.bots.get(&args.bot_id).is_none() {
        return BotNotFound;
    };

    let now = state.env.now();

    let api_key_secret =
        state
            .data
            .bot_api_keys
            .generate(args.bot_id, args.requested_permissions.clone(), now, state.env.rng());

    let api_key_token = BotApiKeyToken {
        gateway: state.data.local_user_index_canister_id,
        bot_id: args.bot_id,
        scope: AccessTokenScope::Chat(Chat::Direct(state.env.canister_id().into())),
        secret: api_key_secret,
        permissions: args.requested_permissions,
    };

    let api_key = base64::from_value(&api_key_token);

    Success(SuccessResult { api_key })
}
