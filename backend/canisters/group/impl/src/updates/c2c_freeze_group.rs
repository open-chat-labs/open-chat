use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_group_index_or_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_freeze_group::{Response::*, *};
use types::{EventWrapper, FrozenGroupInfo, GroupFrozen, Timestamped, UserId};

#[update(guard = "caller_is_group_index_or_local_user_index", msgpack = true)]
#[trace]
fn c2c_freeze_group(args: Args) -> Response {
    execute_update(|state| freeze_group_impl(args.caller, args.reason, args.return_members, state))
}

pub(crate) fn freeze_group_impl(
    caller: UserId,
    reason: Option<String>,
    return_members: bool,
    state: &mut RuntimeState,
) -> Response {
    if state.data.frozen.is_none() {
        let now = state.env.now();

        let push_event_result = state.data.chat.events.freeze(caller, reason.clone(), now);

        state.data.frozen = Timestamped::new(
            Some(FrozenGroupInfo {
                timestamp: now,
                frozen_by: caller,
                reason: reason.clone(),
            }),
            now,
        );

        let event = EventWrapper {
            index: push_event_result.index,
            timestamp: now,
            expires_at: push_event_result.expires_at,
            event: GroupFrozen {
                frozen_by: caller,
                reason,
            },
        };

        handle_activity_notification(state);

        if return_members {
            SuccessWithMembers(event, state.data.chat.members.member_ids().iter().cloned().collect())
        } else {
            Success(event)
        }
    } else {
        ChatAlreadyFrozen
    }
}
