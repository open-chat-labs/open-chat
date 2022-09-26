use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use group_canister::rules::{Response::*, *};

#[query_candid_and_msgpack]
fn rules(args: Args) -> Response {
    read_state(|runtime_state: &RuntimeState| rules_impl(args, runtime_state))
}

fn rules_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if !runtime_state.data.is_accessible_by_non_member(args.invite_code) {
        return NotAuthorized;
    }

    let data = &runtime_state.data;
    let rules = if data.rules.enabled { Some(data.rules.text.clone()) } else { None };
    Success(SuccessResult { rules })
}
