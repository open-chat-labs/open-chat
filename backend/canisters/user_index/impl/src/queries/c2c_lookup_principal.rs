use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use user_index_canister::c2c_lookup_principal::{Response::*, *};

#[query_msgpack]
fn c2c_lookup_principal(args: Args) -> Response {
    read_state(|state| c2c_lookup_principal_impl(args, state))
}

fn c2c_lookup_principal_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(user) = runtime_state.data.users.get_by_user_id(&args.user_id) {
        let is_super_admin = runtime_state.data.platform_moderators.contains(&args.user_id);

        Success(SuccessResult {
            principal: user.principal,
            is_bot: user.is_bot,
            is_super_admin,
        })
    } else {
        UserNotFound
    }
}
