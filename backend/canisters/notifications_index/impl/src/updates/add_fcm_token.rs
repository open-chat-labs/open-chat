use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::add_fcm_token::{Args, Response};
use oc_error_codes::OCErrorCode;
use stable_memory_map::StableMemoryMap;
use types::UnitResult;

#[update(msgpack = true)]
#[trace]
fn add_fcm_token(args: Args) -> Response {
    mutate_state(|state| add_fcm_token_impl(args, state))
}

fn add_fcm_token_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        // This call will add token, and push events to local indexes
        state
            .add_fcm_token(user_id, args.fcm_token)
            .map(|_| UnitResult::Success)
            .unwrap_or_else(|_| UnitResult::Error(OCErrorCode::AlreadyAdded.into()))
    } else {
        UnitResult::Error(OCErrorCode::InitiatorNotFound.into())
    }
}
