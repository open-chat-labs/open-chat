use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use user_canister::c2c_try_add_to_group::{Response::*, *};

#[update]
fn c2c_try_add_to_group(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| c2c_try_add_to_group_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_try_add_to_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.blocked_users.contains(&args.added_by) {
        Blocked
    } else {
        let chat_id = runtime_state.env.caller().into();
        let now = runtime_state.env.now();
        runtime_state.data.group_chats.join(chat_id, now);
        Success(SuccessResult {
            principal: runtime_state.data.owner,
        })
    }
}
