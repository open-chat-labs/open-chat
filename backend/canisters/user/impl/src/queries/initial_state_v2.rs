use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState, WASM_VERSION};
use ic_cdk_macros::query;
use types::UserId;
use user_canister::initial_state_v2::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn initial_state_v2(args: Args) -> Response {
    read_state(|state| initial_state_impl(args, state))
}

fn initial_state_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let my_user_id: UserId = runtime_state.env.canister_id().into();
    let _disable_cache = args.disable_cache.unwrap_or_default();

    let direct_chats = runtime_state
        .data
        .direct_chats
        .iter()
        .map(|d| d.to_summary(my_user_id))
        .collect();

    let group_chats = runtime_state.data.group_chats.iter().map(|g| g.to_summary()).collect();

    Success(SuccessResult {
        timestamp: now,
        direct_chats,
        group_chats,
        cached_group_chat_summaries: Vec::new(),
        blocked_users: runtime_state.data.blocked_users.value.iter().copied().collect(),
        user_canister_wasm_version: WASM_VERSION.with(|version| version.borrow().value),
        pinned_chats: runtime_state.data.pinned_chats.value.clone(),
    })
}
