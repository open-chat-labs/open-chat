use crate::guards::caller_is_user_controller;
use crate::model::bucket_sync_state::EventToSync;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use storage_index_canister::c2c_update_user_principal::*;

#[update_msgpack(guard = "caller_is_user_controller")]
#[trace]
fn c2c_update_user_principal(args: Args) -> Response {
    mutate_state(|state| c2c_update_user_principal_impl(args, state))
}

fn c2c_update_user_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(user) = state.data.users.remove(&args.old_principal) {
        state.data.users.insert(args.new_principal, user);
        state.data.files.update_user_principal(args.old_principal, args.new_principal);
        state
            .data
            .buckets
            .sync_event(EventToSync::UserIdUpdated(args.old_principal, args.new_principal));
    }

    Response::Success
}
