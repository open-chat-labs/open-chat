use crate::model::public_groups::UpdateGroupResult;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_update_group::{Response::*, *};
use types::ChatId;

#[update_msgpack]
#[trace]
fn c2c_update_group(args: Args) -> Response {
    mutate_state(|state| c2c_update_group_impl(args, state))
}

fn c2c_update_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    let chat_id = ChatId::from(state.env.caller());
    match state
        .data
        .public_groups
        .update_group(&chat_id, args.name, args.description, args.avatar_id, args.gate)
    {
        UpdateGroupResult::Success => Success,
        UpdateGroupResult::ChatNotFound => ChatNotFound,
        UpdateGroupResult::NameTaken => NameTaken,
    }
}
