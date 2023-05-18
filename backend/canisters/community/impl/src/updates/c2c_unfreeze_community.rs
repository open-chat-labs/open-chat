use crate::guards::caller_is_group_index_or_local_group_index;
use crate::model::events::CommunityEvent;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_unfreeze_community::{Response::*, *};
use types::{EventWrapper, GroupUnfrozen, Timestamped};

#[update_msgpack(guard = "caller_is_group_index_or_local_group_index")]
#[trace]
async fn c2c_unfreeze_community(args: Args) -> Response {
    mutate_state(|state| c2c_unfreeze_community_impl(args, state))
}

fn c2c_unfreeze_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_some() {
        let now = state.env.now();

        state.data.frozen = Timestamped::new(None, now);

        let event_index = state.data.events.push_event(
            CommunityEvent::Unfrozen(Box::new(GroupUnfrozen {
                unfrozen_by: args.caller,
            })),
            now,
        );

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
