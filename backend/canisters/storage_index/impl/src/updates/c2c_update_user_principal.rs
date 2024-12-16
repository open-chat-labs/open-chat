use crate::guards::caller_is_user_controller;
use crate::model::bucket_event_batch::EventToSync;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use storage_index_canister::c2c_update_user_principal::*;

#[update(guard = "caller_is_user_controller", msgpack = true)]
#[trace]
fn c2c_update_user_principal(args: Args) -> Response {
    mutate_state(|state| c2c_update_user_principal_impl(args, state))
}

fn c2c_update_user_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(user) = state.data.users.remove(&args.old_principal) {
        state.data.users.insert(args.new_principal, user);
        state.data.files.update_user_principal(args.old_principal, args.new_principal);
        state.push_event_to_buckets(EventToSync::UserIdUpdated(args.old_principal, args.new_principal));
    }

    Response::Success
}
