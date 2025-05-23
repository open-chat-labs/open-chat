use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use online_users_canister::last_online::{Response::*, *};

#[query(candid = true, msgpack = true)]
#[trace]
fn last_online(args: Args) -> Response {
    read_state(|state| last_online_impl(args, state))
}

fn last_online_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();

    let result = args
        .user_ids
        .into_iter()
        .filter_map(|u| {
            state.data.last_online_dates.get(u).map(|ts| UserLastOnline {
                user_id: u,
                duration_since_last_online: now.saturating_sub(ts),
            })
        })
        .collect();

    Success(result)
}
