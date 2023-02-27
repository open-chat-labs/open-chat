use crate::{mutate_state, RuntimeState};
use group_canister::c2c_dismiss_super_admin;
use ic_cdk_macros::heartbeat;
use tracing::error;
use types::{CanisterId, ChatId, UserId};

#[heartbeat]
fn heartbeat() {
    sync_users_to_storage_index::run();
    sync_events_to_local_user_index_canisters::run();
    notify_user_principal_migrations::run();
    dismiss_removed_super_admins::run();
}

mod sync_users_to_storage_index {
    use super::*;
    use storage_index_canister::add_or_update_users::UserConfig;

    pub fn run() {
        if let Some((canister_id, users)) = mutate_state(next_batch) {
            ic_cdk::spawn(sync_users(canister_id, users));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Option<(CanisterId, Vec<UserConfig>)> {
        let users = runtime_state.data.storage_index_user_sync_queue.try_start_sync()?;

        Some((runtime_state.data.storage_index_canister_id, users))
    }

    async fn sync_users(storage_index_canister_id: CanisterId, users: Vec<UserConfig>) {
        let args = storage_index_canister::add_or_update_users::Args { users: users.clone() };
        match storage_index_canister_c2c_client::add_or_update_users(storage_index_canister_id, &args).await {
            Ok(_) => mutate_state(on_success),
            Err(_) => mutate_state(|state| on_failure(users, state)),
        }
    }

    fn on_success(runtime_state: &mut RuntimeState) {
        runtime_state.data.storage_index_user_sync_queue.mark_sync_completed();
    }

    fn on_failure(users: Vec<UserConfig>, runtime_state: &mut RuntimeState) {
        runtime_state.data.storage_index_user_sync_queue.mark_sync_failed(users);
    }
}

mod sync_events_to_local_user_index_canisters {
    use super::*;
    use local_user_index_canister::Event as LocalUserIndexEvent;

    pub fn run() {
        if let Some(batch) = mutate_state(next_batch) {
            ic_cdk::spawn(process_batch(batch));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Option<Vec<(CanisterId, Vec<LocalUserIndexEvent>)>> {
        runtime_state.data.user_index_event_sync_queue.try_start_batch()
    }

    async fn process_batch(batch: Vec<(CanisterId, Vec<LocalUserIndexEvent>)>) {
        let futures: Vec<_> = batch
            .into_iter()
            .map(|(canister_id, events)| sync_events(canister_id, events))
            .collect();

        futures::future::join_all(futures).await;

        mutate_state(|state| state.data.user_index_event_sync_queue.mark_batch_completed());
    }

    async fn sync_events(canister_id: CanisterId, events: Vec<LocalUserIndexEvent>) {
        let args = local_user_index_canister::c2c_notify_user_index_events::Args { events: events.clone() };
        if local_user_index_canister_c2c_client::c2c_notify_user_index_events(canister_id, &args)
            .await
            .is_err()
        {
            mutate_state(|state| {
                state
                    .data
                    .user_index_event_sync_queue
                    .mark_sync_failed_for_canister(canister_id, events);
            });
        }
    }
}

mod notify_user_principal_migrations {
    use super::*;
    use crate::model::user_principal_migration_queue::CanisterToNotifyOfUserPrincipalMigration;

    const MAX_CANISTERS_TO_NOTIFY_PER_HEARTBEAT: u32 = 5;

    pub fn run() {
        let next_batch = mutate_state(next_batch);
        if !next_batch.is_empty() {
            ic_cdk::spawn(notify_many(next_batch));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<(UserId, CanisterToNotifyOfUserPrincipalMigration)> {
        (0..MAX_CANISTERS_TO_NOTIFY_PER_HEARTBEAT)
            .map_while(|_| runtime_state.data.user_principal_migration_queue.take())
            .collect()
    }

    async fn notify_many(canisters: Vec<(UserId, CanisterToNotifyOfUserPrincipalMigration)>) {
        let futures: Vec<_> = canisters
            .into_iter()
            .map(|(user_id, canister)| notify(user_id, canister))
            .collect();

        futures::future::join_all(futures).await;
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
            Err(_) => state.data.user_principal_migration_queue.mark_failure(user_id, canister),
        });
    }
}

mod dismiss_removed_super_admins {
    use super::*;

    pub fn run() {
        if let Some((user_id, group_id)) = mutate_state(pop_super_admin_to_dismiss) {
            ic_cdk::spawn(dismiss_super_admin(user_id, group_id));
        }
    }

    fn pop_super_admin_to_dismiss(runtime_state: &mut RuntimeState) -> Option<(UserId, ChatId)> {
        runtime_state.data.super_admins_to_dismiss.pop_front()
    }

    fn push_super_admin_to_dismiss(user_id: UserId, group_id: ChatId, runtime_state: &mut RuntimeState) {
        runtime_state.data.super_admins_to_dismiss.push_back((user_id, group_id));
    }

    async fn dismiss_super_admin(user_id: UserId, group_id: ChatId) {
        let c2c_args = c2c_dismiss_super_admin::Args {
            user_id,
            correlation_id: 0,
        };
        if let Err(error) = group_canister_c2c_client::c2c_dismiss_super_admin(group_id.into(), &c2c_args).await {
            error!(?error, ?user_id, ?group_id, "Error calling group::c2c_dismiss_super_admin");
            mutate_state(|state| push_super_admin_to_dismiss(user_id, group_id, state));
        }
    }
}
