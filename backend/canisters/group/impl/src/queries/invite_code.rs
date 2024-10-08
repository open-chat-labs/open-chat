use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::invite_code::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn invite_code(_: Args) -> Response {
    read_state(invite_code_impl)
}

fn invite_code_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.role.can_invite_users(&state.data.chat.permissions) {
            return Success(SuccessResult {
                code: if state.data.invite_code_enabled { state.data.invite_code } else { None },
            });
        }
    }

    NotAuthorized
}
