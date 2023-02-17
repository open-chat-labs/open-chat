use crate::{mutate_state, RuntimeState};
use group_canister::c2c_dismiss_super_admin;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use ic_cdk_macros::heartbeat;
use tracing::error;
use types::{CanisterId, ChatId, Cycles, CyclesTopUp, UserId, Version};
use utils::canister::{install, FailedUpgrade};
use utils::consts::MIN_CYCLES_BALANCE;
use utils::time::SECOND_IN_MS;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    sync_users_to_open_storage::run();
    sync_events_to_local_user_index_canisters::run();
    notify_user_principal_migrations::run();
    dismiss_removed_super_admins::run();
    set_users_suspended::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToInstall<local_user_index_canister::post_upgrade::Args>;

    pub fn run() {
        let chats_to_upgrade = mutate_state(next_batch);
        if !chats_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(chats_to_upgrade));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<CanisterToUpgrade> {
        let count_in_progress = runtime_state.data.canisters_requiring_upgrade.count_in_progress();
        let max_concurrent_canister_upgrades = runtime_state.data.max_concurrent_canister_upgrades;

        (0..(max_concurrent_canister_upgrades.saturating_sub(count_in_progress)))
            .map_while(|_| try_get_next(runtime_state))
            .collect()
    }

    fn try_get_next(runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let canister_id = runtime_state.data.canisters_requiring_upgrade.try_take_next()?;

        let new_wasm_version = new_wasm.version;
        let current_wasm_version = match runtime_state
            .data
            .local_index_map
            .get(&canister_id)
            .map(|c| c.wasm_version())
            .filter(|v| v != new_wasm_version)
        {
            Some(v) => v,
            None => {
                runtime_state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
                return None;
            }
        };

        let new_wasm = runtime_state.data.local_user_index_canister_wasm_for_upgrades.clone();
        let deposit_cycles_if_needed = ic_cdk::api::canister_balance128() > MIN_CYCLES_BALANCE;

        Some(CanisterToUpgrade {
            canister_id,
            current_wasm_version,
            new_wasm,
            deposit_cycles_if_needed,
            args: local_user_index_canister::post_upgrade::Args {
                wasm_version: new_wasm_version,
            },
            mode: CanisterInstallMode::Upgrade,
            stop_start_canister: true,
        })
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match install(canister_to_upgrade).await {
            Ok(cycles_top_up) => {
                mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, top_up: Option<Cycles>, runtime_state: &mut RuntimeState) {
        let local_user_index = runtime_state
            .data
            .local_index_map
            .get_mut(&canister_id)
            .expect("Cannot find local_user_index");

        local_user_index.set_wasm_version(to_version);

        let top_up = top_up.map(|c| CyclesTopUp {
            amount: c,
            date: runtime_state.env.now(),
        });

        if let Some(top_up) = top_up {
            local_user_index.mark_cycles_top_up(top_up);
        }

        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }
}

mod sync_users_to_open_storage {
    use super::*;
    use open_storage_index_canister::add_or_update_users::UserConfig;

    pub fn run() {
        if let Some((canister_id, users)) = mutate_state(next_batch) {
            ic_cdk::spawn(sync_users(canister_id, users));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Option<(CanisterId, Vec<UserConfig>)> {
        let users = runtime_state.data.open_storage_user_sync_queue.try_start_sync()?;

        Some((runtime_state.data.open_storage_index_canister_id, users))
    }

    async fn sync_users(open_storage_index_canister_id: CanisterId, users: Vec<UserConfig>) {
        let args = open_storage_index_canister::add_or_update_users::Args { users: users.clone() };
        match open_storage_index_canister_c2c_client::add_or_update_users(open_storage_index_canister_id, &args).await {
            Ok(_) => mutate_state(on_success),
            Err(_) => mutate_state(|state| on_failure(users, state)),
        }
    }

    fn on_success(runtime_state: &mut RuntimeState) {
        runtime_state.data.open_storage_user_sync_queue.mark_sync_completed();
    }

    fn on_failure(users: Vec<UserConfig>, runtime_state: &mut RuntimeState) {
        runtime_state.data.open_storage_user_sync_queue.mark_sync_failed(users);
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
            CanisterToNotifyOfUserPrincipalMigration::OpenStorage(canister_id, args) => {
                open_storage_index_canister_c2c_client::update_user_id(*canister_id, args)
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

mod set_users_suspended {
    use super::*;
    use crate::model::set_user_suspended_queue::{SetUserSuspendedInGroup, SetUserSuspendedType};
    use crate::updates::suspend_user::suspend_user_impl;
    use crate::updates::unsuspend_user::unsuspend_user_impl;

    const MAX_BATCH_SIZE: usize = 10;

    pub fn run() {
        let batch = mutate_state(next_batch);
        if !batch.is_empty() {
            ic_cdk::spawn(process_batch(batch));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<SetUserSuspendedType> {
        let now = runtime_state.env.now();

        (0..MAX_BATCH_SIZE)
            .map_while(|_| runtime_state.data.set_user_suspended_queue.take_next_due(now))
            .collect()
    }

    async fn process_batch(batch: Vec<SetUserSuspendedType>) {
        let futures: Vec<_> = batch.into_iter().map(process_single).collect();

        futures::future::join_all(futures).await;
    }

    async fn process_single(value: SetUserSuspendedType) {
        match value {
            SetUserSuspendedType::User(details) => {
                suspend_user_impl(details.user_id, details.duration, details.reason, details.suspended_by).await;
            }
            SetUserSuspendedType::Unsuspend(user_id) => {
                unsuspend_user_impl(user_id).await;
            }
            SetUserSuspendedType::Group(SetUserSuspendedInGroup {
                user_id,
                group,
                suspended,
                attempt,
            }) => {
                let args = group_canister::c2c_set_user_suspended::Args { user_id, suspended };
                if group_canister_c2c_client::c2c_set_user_suspended(group.into(), &args)
                    .await
                    .is_err()
                    && attempt < 10
                {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.set_user_suspended_queue.schedule(
                            vec![SetUserSuspendedType::Group(SetUserSuspendedInGroup {
                                user_id,
                                group,
                                suspended,
                                attempt: attempt + 1,
                            })],
                            now + (10 * SECOND_IN_MS), // Try again in 10 seconds
                        );
                    });
                }
            }
        }
    }
}
