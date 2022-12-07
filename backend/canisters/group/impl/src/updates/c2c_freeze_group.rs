use crate::guards::caller_is_group_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::c2c_freeze_group::{Response::*, *};
use types::{ChatFrozen, EventWrapper, FrozenGroupInfo, Timestamped};

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
async fn c2c_freeze_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_freeze_group_impl(args, state))
}

fn c2c_freeze_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.frozen.is_none() {
        let now = runtime_state.env.now();

        let event_index = runtime_state.data.events.freeze(args.caller, args.reason.clone(), now);
        runtime_state.data.frozen = Timestamped::new(
            Some(FrozenGroupInfo {
                timestamp: now,
                frozen_by: args.caller,
                reason: args.reason.clone(),
            }),
            now,
        );

        if args.return_members {
            SuccessWithMembers(
                EventWrapper {
                    index: event_index,
                    timestamp: now,
                    correlation_id: 0,
                    event: ChatFrozen {
                        frozen_by: args.caller,
                        reason: args.reason,
                    },
                },
                runtime_state.data.participants.iter().map(|p| p.user_id).collect(),
            )
        } else {
            Success(EventWrapper {
                index: event_index,
                timestamp: now,
                correlation_id: 0,
                event: ChatFrozen {
                    frozen_by: args.caller,
                    reason: args.reason,
                },
            })
        }
    } else {
        ChatAlreadyFrozen
    }
}
