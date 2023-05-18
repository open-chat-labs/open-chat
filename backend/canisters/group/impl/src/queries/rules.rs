use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use group_canister::rules::{Response::*, *};

#[query_candid_and_msgpack]
fn rules(args: Args) -> Response {
    read_state(|runtime_state: &RuntimeState| rules_impl(args, runtime_state))
}

fn rules_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if !runtime_state.data.is_accessible(caller, args.invite_code) {
        return NotAuthorized;
    }

    let data = &runtime_state.data;
    let rules = data
        .group_chat_core
        .rules
        .enabled
        .then_some(data.group_chat_core.rules.text.clone());
    Success(SuccessResult { rules })
}
