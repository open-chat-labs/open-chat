use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_group_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_unfreeze_community::{Response::*, *};
use types::{EventWrapper, GroupUnfrozen, Timestamped};

#[update(guard = "caller_is_group_index_or_local_user_index", msgpack = true)]
#[trace]
fn c2c_unfreeze_community(args: Args) -> Response {
    execute_update(|state| c2c_unfreeze_community_impl(args, state))
}

fn c2c_unfreeze_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_some() {
        let now = state.env.now();

        state.data.frozen = Timestamped::new(None, now);

        let event_index = state.data.events.push_event(
            CommunityEventInternal::Unfrozen(Box::new(GroupUnfrozen {
                unfrozen_by: args.caller,
            })),
            now,
        );

        handle_activity_notification(state);

        Success(EventWrapper {
            index: event_index,
            timestamp: now,
            expires_at: None,
            event: GroupUnfrozen {
                unfrozen_by: args.caller,
            },
        })
    } else {
        CommunityNotFrozen
    }
}
