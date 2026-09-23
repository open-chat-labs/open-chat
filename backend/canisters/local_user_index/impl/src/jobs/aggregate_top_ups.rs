use crate::model::top_up_leaderboards::TopUpLeaderboards;
use crate::{RuntimeState, mutate_state};
use constants::MINUTE_IN_MS;
use local_user_index_canister::ChildCanisterType;
use std::time::Duration;
use types::{CanisterId, Milliseconds};
use utils::canister_timers::run_now_then_interval;

const AGGREGATE_TOP_UPS_INTERVAL: Milliseconds = 5 * MINUTE_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(AGGREGATE_TOP_UPS_INTERVAL), run);
}

fn run() {
    mutate_state(run_impl);
}

fn run_impl(state: &mut RuntimeState) {
    let now = state.env.now();
    let data = &state.data;

    let users = data
        .local_users
        .iter_user_canisters()
        .map(|(u, l)| (u.canister_id(), ChildCanisterType::User, l.cycle_top_ups.as_slice()));
    let groups = data
        .local_groups
        .iter()
        .map(|(g, l)| (CanisterId::from(*g), ChildCanisterType::Group, l.cycle_top_ups.as_slice()));
    let communities = data
        .local_communities
        .iter()
        .map(|(c, l)| (CanisterId::from(*c), ChildCanisterType::Community, l.cycle_top_ups.as_slice()));
    let multi_users = data
        .local_multi_user_canisters
        .iter()
        .map(|(c, l)| (*c, ChildCanisterType::MultiUser, l.cycle_top_ups.as_slice()));

    let leaderboards = TopUpLeaderboards::build(users.chain(groups).chain(communities).chain(multi_users), now);
    state.data.top_up_leaderboards = leaderboards;
}
