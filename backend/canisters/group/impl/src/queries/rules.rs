use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::rules::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn rules(args: Args) -> Response {
    read_state(|state| rules_impl(args, state))
}

fn rules_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return NotAuthorized;
    }

    let rules = state.data.chat.rules.text_if_enabled().map(|t| t.value.clone());

    Success(SuccessResult { rules })
}
