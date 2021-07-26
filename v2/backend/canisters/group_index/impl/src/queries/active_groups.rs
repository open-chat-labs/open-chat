use super::active_groups::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::chat_id::GroupChatId;

#[derive(Deserialize)]
struct Args {
    group_ids: Vec<GroupChatId>,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
}

#[derive(CandidType)]
struct SuccessResult {
    active_groups: Vec<GroupChatId>,
}

#[query]
fn active_groups(args: Args) -> Response {
    RUNTIME_STATE.with(|state| active_groups_impl(args, state.borrow().as_ref().unwrap()))
}

fn active_groups_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let active_groups = args
        .group_ids
        .into_iter()
        .filter_map(|id| {
            if let Some(g) = runtime_state.data.private_groups.get(&id) {
                if g.is_active(now) {
                    return Some(g.id());
                }
            } else if let Some(g) = runtime_state.data.public_groups.get(&id) {
                if g.is_active(now) {
                    return Some(g.id());
                }
            }
            None
        })
        .collect();

    let result = SuccessResult { active_groups };

    Success(result)
}
