use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::c2c_is_super_admin::{Response::*, *};

#[query]
fn c2c_is_super_admin(args: Args) -> Response {
    read_state(|state| c2c_is_super_admin_impl(args, state))
}

fn c2c_is_super_admin_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    match runtime_state.data.super_admins.contains(&args.user_id) {
        true => Yes,
        false => No,
    }
}
