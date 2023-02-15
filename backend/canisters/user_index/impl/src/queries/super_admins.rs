use crate::guards::caller_is_governance_principal;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::super_admins::{Response::*, *};

#[query(guard = "caller_is_governance_principal")]
fn super_admins(_args: Args) -> Response {
    read_state(super_admins_impl)
}

fn super_admins_impl(runtime_state: &RuntimeState) -> Response {
    Success(SuccessResult {
        users: runtime_state.data.super_admins.iter().copied().collect(),
    })
}
