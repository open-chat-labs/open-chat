use crate::guards::caller_is_notifications_canister;
use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use local_user_index_canister::c2c_lookup_user_id::*;

#[query_msgpack(guard = "caller_is_notifications_canister")]
fn c2c_lookup_user_id(args: Args) -> Response {
    read_state(|state| c2c_lookup_user_id_impl(args, state))
}

fn c2c_lookup_user_id_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.global_users.get_by_principal(&args.user_principal) {
        return Response::Success(user.user_id);
    }

    Response::UserNotFound
}
