use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{TurnstileConfig, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use tracing::info;
use user_index_canister::set_turnstile_config::*;

// How the LocalUserIndexes check prize claims for a human. Recorded here and fanned out to every
// LocalUserIndex over the event queue, so that one added later is given it too.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_turnstile_config(args: Args) -> Response {
    mutate_state(|state| set_turnstile_config_impl(args, state))
}

fn set_turnstile_config_impl(args: Args, state: &mut RuntimeState) -> Response {
    // Tokens can only be checked with the key, so requiring them without it would check nothing
    if args.required && args.secret_key.is_none() {
        return Response::Error(OCErrorCode::InvalidRequest.with_message("A token can't be required without a secret key"));
    }

    let config = TurnstileConfig {
        secret_key: args.secret_key,
        required: args.required,
    };
    info!(?config, "Turnstile config set");

    state.data.turnstile_config = config.clone();
    state.push_event_to_all_local_user_indexes(UserIndexEvent::SetTurnstileConfig(config), None);
    Response::Success
}
