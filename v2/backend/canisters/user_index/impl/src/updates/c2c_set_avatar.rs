use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use user_index_canister::c2c_set_avatar::{Response::*, *};

#[update]
fn c2c_set_avatar(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_set_avatar_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_set_avatar_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match runtime_state.data.users.set_avatar_id(&caller.into(), args.avatar_id, now) {
        true => Success,
        false => UserNotFound,
    }
}
