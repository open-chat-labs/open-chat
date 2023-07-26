use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_group_index_or_local_group_index;
use crate::model::events::CommunityEventInternal;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_unfreeze_community::{Response::*, *};
use types::{EventWrapper, GroupUnfrozen, Timestamped};

#[update_msgpack(guard = "caller_is_group_index_or_local_group_index")]
#[trace]
async fn c2c_unfreeze_community(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_unfreeze_community_impl(args, state))
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
            correlation_id: 0,
            expires_at: None,
            event: GroupUnfrozen {
                unfrozen_by: args.caller,
            },
        })
    } else {
        CommunityNotFrozen
    }
}
