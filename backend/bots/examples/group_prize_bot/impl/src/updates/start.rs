use crate::guards::caller_is_admin;
use crate::jobs::send_prizes;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_prize_bot::start::*;
use ic_cdk_macros::update;

#[update(guard = "caller_is_admin")]
#[trace]
fn start(_args: Args) -> Response {
    mutate_state(start_impl)
}

fn start_impl(runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.groups.is_empty() {
        Response::NoGroupsJoined
    } else if let Some(prize_data) = &mut runtime_state.data.prize_data {
        let now = runtime_state.env.now();
        if prize_data.end_date <= now {
            Response::EndDateInPast
        } else {
            runtime_state.data.mean_time_between_prizes = (prize_data.end_date - now) / prize_data.prizes.len() as u64;
            runtime_state.data.started = true;
            send_prizes::start_job(runtime_state);
            Response::Success
        }
    } else {
        Response::NotInitialized
    }
}
