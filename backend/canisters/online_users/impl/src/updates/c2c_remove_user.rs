use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use online_users_canister::c2c_remove_user::{Response::*, *};
use stable_memory_map::StableMemoryMap;

#[update(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_remove_user(args: Args) -> Response {
    mutate_state(|state| c2c_remove_user_impl(args, state))
}

fn c2c_remove_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(user_id) = state.data.principal_to_user_id_map.remove(&args.principal) {
        state.data.last_online_dates.remove(user_id);
    }
    Success
}
