use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_group_index_or_local_group_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_freeze_group::{Response::*, *};
use types::{EventWrapper, FrozenGroupInfo, GroupFrozen, Timestamped};

#[update_msgpack(guard = "caller_is_group_index_or_local_group_index")]
#[trace]
fn c2c_freeze_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_freeze_group_impl(args, state))
}

fn c2c_freeze_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.frozen.is_none() {
        let now = runtime_state.env.now();

        let push_event_result = runtime_state
            .data
            .group_chat_core
            .events
            .freeze(args.caller, args.reason.clone(), now);

        runtime_state.data.frozen = Timestamped::new(
            Some(FrozenGroupInfo {
                timestamp: now,
                frozen_by: args.caller,
                reason: args.reason.clone(),
            }),
            now,
        );

        let event = EventWrapper {
            index: push_event_result.index,
            timestamp: now,
            correlation_id: 0,
            expires_at: push_event_result.expires_at,
            event: GroupFrozen {
                frozen_by: args.caller,
                reason: args.reason,
            },
        };

        handle_activity_notification(runtime_state);

        if args.return_members {
            SuccessWithMembers(
                event,
                runtime_state.data.group_chat_core.members.iter().map(|p| p.user_id).collect(),
            )
        } else {
            Success(event)
        }
    } else {
        ChatAlreadyFrozen
    }
}
