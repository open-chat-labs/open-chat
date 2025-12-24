use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{UpdateBlockedUsernamePatterns, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use types::{OCResult, PushIfNotContains};
use user_index_canister::update_blocked_username_patterns::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn update_blocked_username_patterns(args: Args) -> Response {
    mutate_state(|state| update_blocked_username_patterns_impl(args, state)).into()
}

fn update_blocked_username_patterns_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let updated = if args.add {
        state
            .data
            .blocked_username_patterns
            .push_if_not_contains(args.pattern.clone())
    } else {
        let previous_count = state.data.blocked_username_patterns.len();
        state.data.blocked_username_patterns.retain(|p| *p != args.pattern);
        state.data.blocked_username_patterns.len() < previous_count
    };

    if updated {
        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::UpdateBlockedUsernamePatterns(UpdateBlockedUsernamePatterns {
                pattern: args.pattern,
                add: args.add,
            }),
            None,
        );
        Ok(())
    } else {
        Err(OCErrorCode::NoChange.into())
    }
}
