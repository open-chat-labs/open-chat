use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::set_daily_puzzle_canister_id::*;

// Fallback for the governance-guarded `set_daily_puzzle_canister_id` on the UserIndex, which is
// the normal route and fans out to every LocalUserIndex
#[update(guard = "caller_is_platform_operator", candid = true, msgpack = true)]
#[trace]
fn set_daily_puzzle_canister_id(args: Args) -> Response {
    mutate_state(|state| set_daily_puzzle_canister_id_impl(args, state))
}

fn set_daily_puzzle_canister_id_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.set_daily_puzzle_canister_id(args.canister_id);
    Response::Success
}
