use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_mark_active::{Response::*, *};
use types::ChatId;

#[update_candid_and_msgpack]
#[trace]
fn c2c_mark_active(args: Args) -> Response {
    mutate_state(|state| c2c_mark_active_impl(args, state))
}

fn c2c_mark_active_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = ChatId::from(runtime_state.env.caller());
    let now = runtime_state.env.now();

    if let Some(g) = runtime_state.data.private_groups.get_mut(&chat_id) {
        g.mark_active(now + args.duration);
    } else if let Some(g) = runtime_state.data.public_groups.get_mut(&chat_id) {
        let activity = args.public_group_activity.unwrap_or_default();
        g.mark_active(now + args.duration, activity);
    } else {
        return ChatNotFound;
    }
    Success
}
