use crate::read_state;
use crate::RuntimeState;
use community_canister::invite_code::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn invite_code(_: Args) -> Response {
    read_state(invite_code_impl)
}

fn invite_code_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if member.role.can_invite_users(&state.data.permissions) {
            Success(SuccessResult {
                code: if state.data.invite_code_enabled { state.data.invite_code } else { None },
            })
        } else {
            NotAuthorized
        }
    } else {
        UserNotInCommunity
    }
}
