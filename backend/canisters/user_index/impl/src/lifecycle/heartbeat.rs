use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, read_state, RuntimeState, MIN_CYCLES_BALANCE, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use group_canister::c2c_dismiss_super_admin;
use ic_cdk_macros::heartbeat;
use tracing::error;
use types::{CanisterId, ChatId, Cycles, CyclesTopUp, UserId, Version};
use utils::canister::{self, FailedUpgrade};
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, CYCLES_REQUIRED_FOR_UPGRADE};
use utils::cycles::can_spend_cycles;

#[heartbeat]
fn heartbeat() {
    upgrade_canisters::run();
    topup_canister_pool::run();
    retry_failed_messages::run();
    sync_users_to_open_storage::run();
    sync_events_to_user_canisters::run();
    notify_user_principal_migrations::run();
    calculate_metrics::run();
    dismiss_removed_super_admins::run();
    prune_unconfirmed_phone_numbers::run();
}

mod upgrade_canisters {
    use super::*;
    type CanisterToUpgrade = utils::canister::CanisterToUpgrade<user_canister::post_upgrade::Args>;

    pub fn run() {
        let canisters_to_upgrade = mutate_state(next_batch);
        if !canisters_to_upgrade.is_empty() {
            ic_cdk::spawn(perform_upgrades(canisters_to_upgrade));
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

        initialize_upgrade(canister_id, runtime_state).or_else(|| {
            runtime_state.data.canisters_requiring_upgrade.mark_skipped(&canister_id);
            None
        })
    }

    fn initialize_upgrade(canister_id: CanisterId, runtime_state: &mut RuntimeState) -> Option<CanisterToUpgrade> {
        let user_id = canister_id.into();
        let mut user = runtime_state.data.users.get_by_user_id(&user_id).cloned()?;
        let current_wasm_version = user.wasm_version;
        let user_canister_wasm = &runtime_state.data.user_canister_wasm;

        user.set_canister_upgrade_status(true, None);

        let cycles_to_deposit_if_needed = if can_spend_cycles(CYCLES_REQUIRED_FOR_UPGRADE, MIN_CYCLES_BALANCE) {
            Some(CYCLES_REQUIRED_FOR_UPGRADE)
        } else {
            None
        };

        match runtime_state.data.users.update(user) {
            UpdateUserResult::Success => Some(CanisterToUpgrade {
                canister_id,
                current_wasm_version,
                new_wasm: user_canister_wasm.clone(),
                cycles_to_deposit_if_needed,
                args: user_canister::post_upgrade::Args {
                    wasm_version: user_canister_wasm.version,
                },
            }),
            result => {
                error!("Error updating user to be upgraded: {result:?}");
                None
            }
        }
    }

    async fn perform_upgrades(canisters_to_upgrade: Vec<CanisterToUpgrade>) {
        let futures: Vec<_> = canisters_to_upgrade.into_iter().map(perform_upgrade).collect();

        futures::future::join_all(futures).await;
    }

    async fn perform_upgrade(canister_to_upgrade: CanisterToUpgrade) {
        let canister_id = canister_to_upgrade.canister_id;
        let from_version = canister_to_upgrade.current_wasm_version;
        let to_version = canister_to_upgrade.new_wasm.version;

        match canister::upgrade(canister_to_upgrade).await {
            Ok(cycles_top_up) => {
                mutate_state(|state| on_success(canister_id, to_version, cycles_top_up, state));
            }
            Err(_) => {
                mutate_state(|state| on_failure(canister_id, from_version, to_version, state));
            }
        }
    }

    fn on_success(canister_id: CanisterId, to_version: Version, top_up: Option<Cycles>, runtime_state: &mut RuntimeState) {
        let user_id = canister_id.into();
        mark_upgrade_complete(user_id, Some(to_version), runtime_state);

        if let Some(top_up) = top_up {
            runtime_state.data.users.mark_cycles_top_up(
                &user_id,
                CyclesTopUp {
                    amount: top_up,
                    date: runtime_state.env.now(),
                },
            );
        }

        runtime_state.data.canisters_requiring_upgrade.mark_success(&canister_id);
    }

    fn on_failure(canister_id: CanisterId, from_version: Version, to_version: Version, runtime_state: &mut RuntimeState) {
        mark_upgrade_complete(canister_id.into(), None, runtime_state);

        runtime_state.data.canisters_requiring_upgrade.mark_failure(FailedUpgrade {
            canister_id,
            from_version,
            to_version,
        });
    }

    fn mark_upgrade_complete(user_id: UserId, new_wasm_version: Option<Version>, runtime_state: &mut RuntimeState) {
        if let Some(mut user) = runtime_state.data.users.get_by_user_id(&user_id).cloned() {
            user.set_canister_upgrade_status(false, new_wasm_version);
            runtime_state.data.users.update(user);
        }
    }
}

mod topup_canister_pool {
    use super::*;

    pub fn run() {
        let is_full = read_state(is_pool_full);
        if !is_full {
            let cycles_to_use = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;

            // Only create the new canister if it won't result in the cycles balance being too low
            if utils::cycles::can_spend_cycles(cycles_to_use, MIN_CYCLES_BALANCE) {
                ic_cdk::spawn(add_new_canister(cycles_to_use));
            }
        }
    }

    fn is_pool_full(runtime_state: &RuntimeState) -> bool {
        runtime_state.data.canister_pool.is_full()
    }

    async fn add_new_canister(cycles_to_use: Cycles) {
        if let Ok(canister_id) = canister::create(cycles_to_use).await {
            mutate_state(|state| add_canister_to_pool(canister_id, cycles_to_use, state));
        }
    }

    fn add_canister_to_pool(canister_id: CanisterId, cycles: Cycles, runtime_state: &mut RuntimeState) {
        runtime_state.data.canister_pool.push(canister_id);
        runtime_state.data.total_cycles_spent_on_canisters += cycles;
    }
}

mod retry_failed_messages {
    use super::*;

    const MAX_MESSAGES_TO_RETRY_PER_HEARTBEAT: u32 = 5;

    pub fn run() {
        let messages_to_retry = mutate_state(next_batch);
        if !messages_to_retry.is_empty() {
            ic_cdk::spawn(send_to_canisters(messages_to_retry));
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Vec<(UserId, UserId)> {
        let canisters_requiring_upgrade = &runtime_state.data.canisters_requiring_upgrade;
        // Filter out canisters that are currently being upgraded
        let filter = |_: &UserId, recipient: &UserId| {
            let canister_id: CanisterId = (*recipient).into();
            !canisters_requiring_upgrade.is_in_progress(&canister_id)
        };

        runtime_state
            .data
            .failed_messages_pending_retry
            .take_oldest(MAX_MESSAGES_TO_RETRY_PER_HEARTBEAT, filter)
    }

    async fn send_to_canisters(messages_to_retry: Vec<(UserId, UserId)>) {
        let futures: Vec<_> = messages_to_retry
            .into_iter()
            .map(|(sender, recipient)| send_to_canister(sender, recipient))
            .collect();

        futures::future::join_all(futures).await;
    }

    async fn send_to_canister(sender: UserId, recipient: UserId) {
        let args = user_canister::c2c_retry_sending_failed_messages::Args { recipient };
        let _ = user_canister_c2c_client::c2c_retry_sending_failed_messages(sender.into(), &args).await;
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

mod sync_events_to_user_canisters {
    use types::UserEvent;

    use super::*;

    pub fn run() {
        if let Some(users_events) = mutate_state(next_batch) {
            for (user_id, events) in users_events {
                ic_cdk::spawn(sync_events(user_id, events));
            }
        }
    }

    fn next_batch(runtime_state: &mut RuntimeState) -> Option<Vec<(UserId, Vec<UserEvent>)>> {
        runtime_state.data.user_event_sync_queue.try_start_sync()
    }

    async fn sync_events(user_id: UserId, events: Vec<UserEvent>) {
        let args = user_canister::c2c_notify_user_events::Args { events: events.clone() };
        match user_canister_c2c_client::c2c_notify_user_events(user_id.into(), &args).await {
            Ok(_) => mutate_state(on_success),
            Err(_) => mutate_state(|state| on_failure(user_id, events, state)),
        }
    }

    fn on_success(runtime_state: &mut RuntimeState) {
        runtime_state.data.user_event_sync_queue.mark_sync_completed();
    }

    fn on_failure(user_id: UserId, events: Vec<UserEvent>, runtime_state: &mut RuntimeState) {
        runtime_state.data.user_event_sync_queue.mark_sync_failed(user_id, events);
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
                notifications_canister_c2c_client::c2c_update_user_principal(*canister_id, args)
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

mod calculate_metrics {
    use super::*;

    pub fn run() {
        mutate_state(calculate_metrics);
    }

    fn calculate_metrics(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.users.calculate_metrics(now);
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
        let c2c_args = c2c_dismiss_super_admin::Args { user_id };
        if let Err(error) = group_canister_c2c_client::c2c_dismiss_super_admin(group_id.into(), &c2c_args).await {
            error!(?error, ?user_id, ?group_id, "Error calling group::c2c_dismiss_super_admin");
            mutate_state(|state| push_super_admin_to_dismiss(user_id, group_id, state));
        }
    }
}

mod prune_unconfirmed_phone_numbers {
    use super::*;

    pub fn run() {
        mutate_state(prune_unconfirmed_phone_numbers_impl);
    }

    fn prune_unconfirmed_phone_numbers_impl(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.data.users.prune_unconfirmed_phone_numbers_if_required(now);
    }
}
