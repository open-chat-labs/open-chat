use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use online_users_canister::online_minutes::{Response::*, *};
use stable_memory_map::StableMemoryMap;
use utils::time::MonthKey;

#[query(msgpack = true)]
#[trace]
fn online_minutes(args: Args) -> Response {
    read_state(|state| online_minutes_impl(args, state))
}

fn online_minutes_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    let minutes = if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        state
            .data
            .user_online_minutes
            .get(user_id, MonthKey::new(args.year, args.month))
    } else {
        0
    };

    Success(minutes)
}
