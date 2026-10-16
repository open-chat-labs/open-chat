use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{SetAlchemyApiKey, UserIndexEvent};
use tracing::info;
use user_index_canister::set_alchemy_api_key::*;

// The key the MultiUser canisters use to call Alchemy's Solana RPC. Recorded here and fanned out to
// every LocalUserIndex over the event queue, each of which passes it on to its MultiUser canisters,
// so that a LocalUserIndex or MultiUser canister created later is given it too.
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn set_alchemy_api_key(args: Args) -> Response {
    mutate_state(|state| set_alchemy_api_key_impl(args, state))
}

fn set_alchemy_api_key_impl(args: Args, state: &mut RuntimeState) -> Response {
    let is_set = args.api_key.is_some();
    state.data.alchemy_api_key = args.api_key.clone();

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::SetAlchemyApiKey(SetAlchemyApiKey { api_key: args.api_key }),
        None,
    );

    info!(is_set, "Alchemy API key set");
    Response::Success
}
