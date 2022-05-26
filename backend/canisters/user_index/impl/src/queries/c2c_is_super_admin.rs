use crate::{read_state, RuntimeState};
use canister_api_macros::query_candid_and_msgpack;
use user_index_canister::c2c_is_super_admin::{Response::*, *};

#[query_candid_and_msgpack]
fn c2c_is_super_admin(args: Args) -> Response {
    read_state(|state| c2c_is_super_admin_impl(args, state))
}

fn c2c_is_super_admin_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    match runtime_state.data.super_admins.contains(&args.user_id) {
        true => Yes,
        false => No,
    }
}
