use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_mark_active::{Response::*, *};
use types::{ChatId, Milliseconds, PublicGroupActivity};

#[update(msgpack = true)]
#[trace]
fn c2c_mark_active(args: Args) -> Response {
    mutate_state(|state| {
        let chat_id = ChatId::from(state.env.caller());
        mark_group_active(chat_id, args.duration, args.public_group_activity, state)
    })
}

pub(crate) fn mark_group_active(
    chat_id: ChatId,
    duration: Milliseconds,
    public_group_activity: Option<PublicGroupActivity>,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();

    if let Some(g) = state.data.private_groups.get_mut(&chat_id) {
        g.mark_active(now + duration);
    } else if let Some(g) = state.data.public_groups.get_mut(&chat_id) {
        let activity = public_group_activity.unwrap_or_default();
        g.mark_active(now + duration, activity);
    } else {
        return ChatNotFound;
    }
    Success
}
