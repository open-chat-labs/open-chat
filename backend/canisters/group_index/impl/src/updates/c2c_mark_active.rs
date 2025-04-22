use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_mark_active::{Response::*, *};
use types::ChatId;

#[update(msgpack = true)]
#[trace]
fn c2c_mark_active(args: Args) -> Response {
    mutate_state(|state| c2c_mark_active_impl(args, state))
}

fn c2c_mark_active_impl(args: Args, state: &mut RuntimeState) -> Response {
    let chat_id = ChatId::from(state.env.caller());
    let now = state.env.now();

    if let Some(g) = state.data.private_groups.get_mut(&chat_id) {
        g.mark_active(now + args.duration);
    } else if let Some(g) = state.data.public_groups.get_mut(&chat_id) {
        let activity = args.public_group_activity.unwrap_or_default();
        g.mark_active(now + args.duration, activity);
    } else {
        return ChatNotFound;
    }
    Success
}
