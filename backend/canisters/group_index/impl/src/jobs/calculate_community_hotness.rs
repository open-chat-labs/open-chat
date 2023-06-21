use crate::{mutate_state, RuntimeState};
use rand::RngCore;
use std::time::Duration;
use types::Milliseconds;
use utils::time::MINUTE_IN_MS;

const INTERVAL: Milliseconds = 30 * MINUTE_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(INTERVAL), run);
}

fn run() {
    mutate_state(calculate_community_hotness);
}

fn calculate_community_hotness(state: &mut RuntimeState) {
    let now = state.env.now();

    for community in state.data.public_communities.iter_mut() {
        let random = state.env.rng().next_u32();
        community.calculate_hotness(now, random);
    }
}
