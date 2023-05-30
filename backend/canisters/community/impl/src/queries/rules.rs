use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_candid_and_msgpack;
use community_canister::rules::{Response::*, *};

#[query_candid_and_msgpack]
fn rules(args: Args) -> Response {
    read_state(|state: &RuntimeState| rules_impl(args, state))
}

fn rules_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return NotAuthorized;
    }

    let data = &state.data;
    let rules = data.rules.enabled.then_some(data.rules.text.clone());
    Success(SuccessResult { rules })
}
