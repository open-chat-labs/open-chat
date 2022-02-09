use crate::guards::caller_is_notifications_canister;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::c2c_lookup_user_id::*;

#[query(guard = "caller_is_notifications_canister")]
fn c2c_lookup_user_id(args: Args) -> Response {
    read_state(|state| c2c_lookup_user_id_impl(args, state))
}

fn c2c_lookup_user_id_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.users.get_by_principal(&args.user_principal) {
        return Response::Success(user.user_id);
    }

    Response::UserNotFound
}
