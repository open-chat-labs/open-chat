use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_sync_deleted_users::{Response::*, *};

#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_sync_deleted_users(args: Args) -> Response {
    mutate_state(|state| c2c_sync_deleted_users_impl(args, state))
}

fn c2c_sync_deleted_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.deleted_users.extend(args.user_ids);
    Success
}
