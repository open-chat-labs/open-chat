use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use group_canister::rules::{Response::*, *};

#[query_candid_and_msgpack]
fn rules(_args: Args) -> Response {
    read_state(rules_impl)
}

fn rules_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if !runtime_state.data.is_accessible_by_non_member(caller) {
        return NotAuthorized;
    }

    let data = &runtime_state.data;
    let rules = data.rules.enabled.then_some(data.rules.text.clone());
    Success(SuccessResult { rules })
}
