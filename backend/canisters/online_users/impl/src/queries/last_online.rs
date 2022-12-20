use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::query;
use online_users_canister::last_online::{Response::*, *};

#[query]
#[trace]
fn last_online(args: Args) -> Response {
    read_state(|state| last_online_impl(args, state))
}

fn last_online_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let result = args
        .user_ids
        .into_iter()
        .filter_map(|u| {
            runtime_state.data.last_online_dates.get(u).map(|ts| UserLastOnline {
                user_id: u,
                duration_since_last_online: now.saturating_sub(ts),
            })
        })
        .collect();

    Success(result)
}
