use crate::guards::caller_is_notifications_canister;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_index_canister::c2c_lookup_user_id::*;

#[query(guard = "caller_is_notifications_canister")]
fn c2c_lookup_user_id(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_lookup_user_id_impl(args, state.borrow().as_ref().unwrap()))
}

fn c2c_lookup_user_id_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.users.get_by_principal(&args.user_principal) {
        if let Some(user_id) = user.get_user_id() {
            return Response::Success(user_id);
        }
    }

    Response::UserNotFound
}
