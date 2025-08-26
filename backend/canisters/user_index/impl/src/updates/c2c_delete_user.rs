use crate::guards::caller_is_identity_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{DeleteUser, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use user_index_canister::c2c_delete_user::*;

#[update(guard = "caller_is_identity_canister", msgpack = true)]
#[trace]
fn c2c_delete_user(args: Args) -> Response {
    mutate_state(|state| c2c_delete_user_impl(args, state))
}

fn c2c_delete_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.delete_user(args.user_id, true) {
        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::DeleteUser(DeleteUser {
                user_id: args.user_id,
                triggered_by_user: true,
            }),
            None,
        );
        Response::Success
    } else {
        Response::Error(OCErrorCode::TargetUserNotFound.into())
    }
}
