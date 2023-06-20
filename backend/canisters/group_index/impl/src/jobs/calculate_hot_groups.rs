use crate::model::cached_hot_groups::CachedPublicGroupSummary;
use crate::{mutate_state, RuntimeState, FIVE_MINUTES_IN_MS};
use rand::RngCore;
use std::time::Duration;
use types::{ChatId, Milliseconds};

const HOT_GROUPS_REFRESH_INTERVAL: Milliseconds = FIVE_MINUTES_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(HOT_GROUPS_REFRESH_INTERVAL), run);
}

fn run() {
    let groups = mutate_state(calculate_hot_group_ids);
    ic_cdk::spawn(hydrate_and_set_hot_groups(groups));
}

fn calculate_hot_group_ids(state: &mut RuntimeState) -> Vec<ChatId> {
    let now = state.env.now();
    let random = state.env.rng().next_u32();
    state.data.public_groups.calculate_hot_groups(now, random)
}

async fn hydrate_and_set_hot_groups(chat_ids: Vec<ChatId>) {
    let hydrated = hydrate_hot_groups(chat_ids).await;

    mutate_state(|state| {
        let now = state.env.now();
        state.data.cached_hot_groups.update(hydrated, now);
    })
}

async fn hydrate_hot_groups(chat_ids: Vec<ChatId>) -> Vec<CachedPublicGroupSummary> {
    use group_canister::public_summary::{Args, Response};

    let args = Args { invite_code: None };

    let futures: Vec<_> = chat_ids
        .into_iter()
        .map(|chat_id| group_canister_c2c_client::public_summary(chat_id.into(), &args))
        .collect();

    let responses = futures::future::join_all(futures).await;

    responses
        .into_iter()
        .filter_map(|r| if let Ok(Response::Success(result)) = r { Some(result) } else { None })
        .map(|r| r.summary.into())
        .collect()
}
