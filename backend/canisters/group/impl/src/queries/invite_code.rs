use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use group_canister::invite_code::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(msgpack = true)]
fn invite_code(_: Args) -> Response {
    match read_state(invite_code_impl) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn invite_code_impl(state: &RuntimeState) -> OCResult<SuccessResult> {
    let member = state.get_calling_member(true)?;
    if member.role().can_invite_users(&state.data.chat.permissions) {
        Ok(SuccessResult {
            code: if state.data.invite_code_enabled { state.data.invite_code } else { None },
        })
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
