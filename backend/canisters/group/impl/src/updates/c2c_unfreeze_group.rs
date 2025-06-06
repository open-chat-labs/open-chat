use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_group_index_or_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_unfreeze_group::{Response::*, *};
use types::{EventWrapper, GroupUnfrozen, Timestamped, UserId};

#[update(guard = "caller_is_group_index_or_local_user_index", msgpack = true)]
#[trace]
async fn c2c_unfreeze_group(args: Args) -> Response {
    execute_update(|state| c2c_unfreeze_group_impl(args.caller, state))
}

pub(crate) fn c2c_unfreeze_group_impl(user_id: UserId, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_some() {
        let now = state.env.now();

        let push_event_result = state.data.chat.events.unfreeze(user_id, now);
        state.data.frozen = Timestamped::new(None, now);
        state.data.community_being_imported_into = None;
        state.push_bot_notification(push_event_result.bot_notification);
        handle_activity_notification(state);

        Success(EventWrapper {
            index: push_event_result.index,
            timestamp: now,
            expires_at: push_event_result.expires_at,
            event: GroupUnfrozen { unfrozen_by: user_id },
        })
    } else {
        ChatNotFrozen
    }
}
