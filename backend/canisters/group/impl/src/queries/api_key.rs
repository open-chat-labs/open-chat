use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::api_key::{Response::*, *};

#[query(msgpack = true)]
fn api_key(args: Args) -> Response {
    read_state(|state| api_key_impl(args, state))
}

fn api_key_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.get_member(caller).is_some_and(|member| member.role().is_owner()) {
        return NotAuthorized;
    }

    match state.data.bot_api_keys.get(&args.bot_id) {
        Some(api_key) => Success(api_key.clone()),
        None => NotFound,
    }
}
