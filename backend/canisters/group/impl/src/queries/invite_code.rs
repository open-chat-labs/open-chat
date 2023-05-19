use crate::read_state;
use crate::RuntimeState;
use group_canister::invite_code::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn invite_code(_: Args) -> Response {
    read_state(invite_code_impl)
}

fn invite_code_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.role.can_invite_users(&runtime_state.data.chat.permissions) {
            return Success(SuccessResult {
                code: if runtime_state.data.invite_code_enabled { runtime_state.data.invite_code } else { None },
            });
        }
    }

    NotAuthorized
}
