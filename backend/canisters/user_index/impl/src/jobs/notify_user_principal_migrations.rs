use crate::model::user_principal_migration_queue::CanisterToNotifyOfUserPrincipalMigration;
use crate::{mutate_state, read_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::UserId;

const MAX_CANISTERS_TO_NOTIFY_PER_HEARTBEAT: u32 = 5;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.user_principal_migration_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

pub fn run() {
    info!("'notify_user_principal_migrations' job running");
    TIMER_ID.set(None);

    let next_batch = mutate_state(next_batch);
    if !next_batch.is_empty() {
        ic_cdk::spawn(notify_many(next_batch));
    }
    read_state(start_job_if_required);
}

fn next_batch(state: &mut RuntimeState) -> Vec<(UserId, CanisterToNotifyOfUserPrincipalMigration)> {
    (0..MAX_CANISTERS_TO_NOTIFY_PER_HEARTBEAT)
        .map_while(|_| state.data.user_principal_migration_queue.take())
        .collect()
}

async fn notify_many(canisters: Vec<(UserId, CanisterToNotifyOfUserPrincipalMigration)>) {
    let futures: Vec<_> = canisters
        .into_iter()
        .map(|(user_id, canister)| notify(user_id, canister))
        .collect();

    futures::future::join_all(futures).await;

    read_state(start_job_if_required);
}

async fn notify(user_id: UserId, canister: CanisterToNotifyOfUserPrincipalMigration) {
    let result = match &canister {
        CanisterToNotifyOfUserPrincipalMigration::StorageIndex(canister_id, args) => {
            storage_index_canister_c2c_client::update_user_id(*canister_id, args)
                .await
                .map(|_| ())
        }
        CanisterToNotifyOfUserPrincipalMigration::Notifications(canister_id, args) => {
            notifications_index_canister_c2c_client::c2c_update_user_principal(*canister_id, args)
                .await
                .map(|_| ())
        }
        CanisterToNotifyOfUserPrincipalMigration::Group(chat_id, args) => {
            group_canister_c2c_client::c2c_update_user_principal((*chat_id).into(), args)
                .await
                .map(|_| ())
        }
    };

    mutate_state(|state| match result {
        Ok(_) => state.data.user_principal_migration_queue.mark_success(user_id),
        Err(_) => {
            state.data.user_principal_migration_queue.mark_failure(user_id, canister);
        }
    });
}
