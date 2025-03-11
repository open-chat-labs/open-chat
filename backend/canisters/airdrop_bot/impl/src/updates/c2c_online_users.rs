use crate::guards::caller_is_online_users_canister;
use crate::{mutate_state, RuntimeState};
use airdrop_bot_canister::c2c_online_users::{Response::*, *};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use utils::time::MonthKey;

#[update(guard = "caller_is_online_users_canister", msgpack = true)]
#[trace]
fn c2c_online_users(args: Args) -> Response {
    mutate_state(|state| c2c_online_users_impl(args, state))
}

fn c2c_online_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.online_users_canister_id, event.created_at, event.idempotency_id)
        {
            match event.value {
                OnlineUsersEvent::OnlineForMinutes(o) => {
                    state
                        .data
                        .user_minutes_online
                        .push(o.user_id, MonthKey::new(o.year, o.month), o.minutes_online);
                }
            }
        }
    }

    Success
}
