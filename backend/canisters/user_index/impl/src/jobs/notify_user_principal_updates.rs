use crate::{mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, UpdateUserPrincipalArgs, UpdateUserPrincipalResponse};

const BATCH_SIZE: u32 = 50;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_principal_updates_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        info!("'user_principal_updates_queue' job started");
        true
    } else {
        false
    }
}

pub fn run() {
    let next_batch = mutate_state(next_batch);
    if !next_batch.is_empty() {
        ic_cdk::spawn(notify_many(next_batch));
    } else if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
        info!("'user_principal_updates_queue' job stopped");
    }
}

fn next_batch(state: &mut RuntimeState) -> Vec<(CanisterId, UpdateUserPrincipalArgs)> {
    (0..BATCH_SIZE)
        .map_while(|_| state.data.user_principal_updates_queue.take())
        .collect()
}

async fn notify_many(canisters: Vec<(CanisterId, UpdateUserPrincipalArgs)>) {
    let futures: Vec<_> = canisters
        .into_iter()
        .map(|(canister_id, args)| notify(canister_id, args))
        .collect();

    futures::future::join_all(futures).await;
}

async fn notify(canister_id: CanisterId, args: UpdateUserPrincipalArgs) {
    let response = c2c_update_user_principal(canister_id, &args).await;

    mutate_state(|state| match response {
        Ok(_) => state.data.user_principal_updates_queue.mark_success(args.user_id),
        Err(_) => {
            state.data.user_principal_updates_queue.mark_failure(canister_id, args);
            start_job_if_required(state);
        }
    });
}

canister_client::generate_c2c_call!(c2c_update_user_principal);

pub mod c2c_update_user_principal {
    use super::*;

    pub type Args = UpdateUserPrincipalArgs;
    pub type Response = UpdateUserPrincipalResponse;
}
