use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_group_index_or_local_group_index;
use crate::model::events::CommunityEvent;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_freeze_community::{Response::*, *};
use types::{EventWrapper, FrozenGroupInfo, GroupFrozen, Timestamped};

#[update_msgpack(guard = "caller_is_group_index_or_local_group_index")]
#[trace]
fn c2c_freeze_community(args: Args) -> Response {
    mutate_state(|state| c2c_freeze_community_impl(args, state))
}

fn c2c_freeze_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.frozen.is_none() {
        let now = state.env.now();

        state.data.frozen = Timestamped::new(
            Some(FrozenGroupInfo {
                timestamp: now,
                frozen_by: args.caller,
                reason: args.reason.clone(),
            }),
            now,
        );

        let event_index = state.data.events.push_event(
            CommunityEvent::Frozen(Box::new(GroupFrozen {
                frozen_by: args.caller,
                reason: args.reason.clone(),
            })),
            now,
        );

        let event = EventWrapper {
            index: event_index,
            timestamp: now,
            correlation_id: 0,
            expires_at: None,
            event: GroupFrozen {
                frozen_by: args.caller,
                reason: args.reason,
            },
        };

        handle_activity_notification(state);

        if args.return_members {
            SuccessWithMembers(event, state.data.members.iter().map(|p| p.user_id).collect())
        } else {
            Success(event)
        }
    } else {
        CommunityAlreadyFrozen
    }
}
