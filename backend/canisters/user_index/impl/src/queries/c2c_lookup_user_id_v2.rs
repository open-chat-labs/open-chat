use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use user_index_canister::c2c_lookup_user_id_v2::{Response::*, *};

#[query_msgpack]
fn c2c_lookup_user_id_v2(args: Args) -> Response {
    read_state(|state| c2c_lookup_user_id_impl(args, state))
}

fn c2c_lookup_user_id_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.users.get_by_principal(&args.user_principal) {
        let is_super_admin = runtime_state.data.super_admins.contains(&user.user_id);

        Success(SuccessResult {
            user_id: user.user_id,
            is_bot: user.is_bot,
            is_super_admin,
        })
    } else {
        UserNotFound
    }
}
