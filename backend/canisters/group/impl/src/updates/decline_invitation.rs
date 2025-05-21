use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::decline_invitation::*;
use oc_error_codes::OCErrorCode;

#[update(msgpack = true)]
#[trace]
fn decline_invitation(_args: Args) -> Response {
    execute_update(decline_invitation_impl)
}

fn decline_invitation_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    match state.data.remove_invitation(caller, now) {
        Some(_) => Response::Success,
        None => Response::Error(OCErrorCode::NoChange.into()),
    }
}
