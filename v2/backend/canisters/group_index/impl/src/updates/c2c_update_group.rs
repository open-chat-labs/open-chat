use crate::model::public_groups::UpdateGroupResult;
use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_update_group::{Response::*, *};
use ic_cdk_macros::update;
use tracing::instrument;
use types::ChatId;

#[update]
#[instrument(level = "trace")]
fn c2c_update_group(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_update_group_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_update_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = ChatId::from(runtime_state.env.caller());
    match runtime_state
        .data
        .public_groups
        .update_group(&chat_id, args.name, args.description, args.avatar_id)
    {
        UpdateGroupResult::Success => Success,
        UpdateGroupResult::ChatNotFound => ChatNotFound,
        UpdateGroupResult::NameTaken => NameTaken,
    }
}
