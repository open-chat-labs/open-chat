use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::updates::{refund_deleted_user_cycles, set_daily_puzzle_canister_id};
use crate::{Data, mutate_state, read_state};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use notifications_index_canister::{
    UserIdMigrated as NotificationsIndexUserIdMigrated, UserIndexEvent as NotificationsIndexEvent,
};
use online_users_canister::{UserDeleted, UserIdMigrated, UserIndexEvent as OnlineUsersEvent};
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, UserId};
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    // One-off: refund the cycles still held by users deleted before cycles were refunded on
    // deletion. The flag is only set once the canisters have been queued, so if this upgrade is
    // followed by another before that happens, it is simply retried after the next one.
    // The LocalUserIndexes must be upgraded first so that they can handle the refund events.
    // TODO remove after the release containing this has been deployed
    if !read_state(|state| state.data.deleted_user_cycles_refund_queued) {
        ic_cdk_timers::set_timer(Duration::ZERO, async {
            let response = refund_deleted_user_cycles::run().await;
            info!(?response, "Queued the cycles of previously deleted users to be refunded");
        });
    }

    // One-off: move bot installations recorded under the wrong type of location back to the direct
    // chat they were really installed into
    // TODO remove after the release containing this has been deployed
    mutate_state(|state| {
        let now = state.env.now();
        for (bot_id, from, to) in state.data.users.repair_misrecorded_direct_chat_bot_installations(now) {
            info!(%bot_id, ?from, ?to, "Moved misrecorded bot installation");
        }
    });

    // One-off: point the new NotificationsIndex event queue, which was created with a placeholder
    // target, at the NotificationsIndex, then tell it the new id of each user migrated so far, so that
    // it stops knowing them by their old one. The events are pushed from a timer because pushing them
    // starts sending them, which makes c2c calls, which can't be made from post_upgrade.
    // TODO remove after the release containing this has been deployed, along with the queue's serde default
    mutate_state(|state| {
        let notifications_index_canister_id = state.data.notifications_index_canister_id;
        state
            .data
            .notifications_index_event_sync_queue
            .set_state(notifications_index_canister_id);
    });
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        mutate_state(|state| {
            let migrated_users = migrated_users(&state.data);

            info!(
                count = migrated_users.len(),
                "Telling the NotificationsIndex about previously migrated users"
            );
            for (user_principal, old_user_id, new_user_id) in migrated_users {
                state.push_event_to_notifications_index(NotificationsIndexEvent::UserIdMigrated(
                    NotificationsIndexUserIdMigrated {
                        user_principal,
                        old_user_id,
                        new_user_id,
                    },
                ));
            }
        });
    });

    // One-off: point the new OnlineUsers event queue, which was created with a placeholder target, at
    // the OnlineUsers canister. Then send it the users queued to be removed from it the old way, and
    // tell it the new id of each user migrated so far, so that it stops knowing them by their old id.
    // Each of a user's old ids is mapped straight to their latest id, so the events can be handled in
    // any order. The events are pushed from a timer because pushing them starts sending them, which
    // makes c2c calls, which can't be made from post_upgrade. They are idempotent, so running this on
    // more than one upgrade is harmless.
    // TODO remove after the release containing this has been deployed, along with the queue's serde
    // default and `remove_from_online_users_queue`
    mutate_state(|state| {
        let online_users_canister_id = state.data.online_users_canister_id;
        state.data.online_users_event_sync_queue.set_state(online_users_canister_id);
    });
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        mutate_state(|state| {
            let users_to_remove: Vec<_> = state.data.remove_from_online_users_queue.drain(..).collect();
            let migrated_users = migrated_users(&state.data);

            info!(
                users_to_remove = users_to_remove.len(),
                migrated_users = migrated_users.len(),
                "Sending events to the OnlineUsers canister"
            );
            for user_principal in users_to_remove {
                state.push_event_to_online_users(OnlineUsersEvent::UserDeleted(UserDeleted { user_principal }));
            }
            for (user_principal, old_user_id, new_user_id) in migrated_users {
                state.push_event_to_online_users(OnlineUsersEvent::UserIdMigrated(UserIdMigrated {
                    user_principal,
                    old_user_id,
                    new_user_id,
                }));
            }
        });
    });

    // One-off: record the prod daily_puzzle canister id and push it to every LocalUserIndex, in
    // place of a governance proposal. Run from a timer because the push makes c2c calls, which
    // can't be made from post_upgrade. The LocalUserIndexes must be upgraded first so that they
    // can handle the event.
    // TODO remove after the release containing this has been deployed
    if read_state(|state| !state.data.test_mode && state.data.daily_puzzle_canister_id.is_none()) {
        ic_cdk_timers::set_timer(Duration::ZERO, async {
            let canister_id = CanisterId::from_text("5cz5j-uiaaa-aaaaf-bsdda-cai").unwrap();
            mutate_state(|state| {
                set_daily_puzzle_canister_id::set_daily_puzzle_canister_id_impl(
                    user_index_canister::set_daily_puzzle_canister_id::Args { canister_id },
                    state,
                )
            });
        });
    }

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

// Each of the old ids of every migrated user, mapped straight to their latest id, along with their
// principal. Users who have since been deleted are left out.
fn migrated_users(data: &Data) -> Vec<(Principal, UserId, UserId)> {
    data.migrated_user_ids
        .iter()
        .filter_map(|(old_user_id, _)| {
            let new_user_id = data.migrated_user_ids.latest(old_user_id);
            data.users
                .get_by_user_id(&new_user_id)
                .map(|u| (u.principal, old_user_id, new_user_id))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::User;

    // User 1 has been migrated to user 2, user 3 to user 4 then to user 5, and user 6 to user 7,
    // who has since been deleted. User 8 hasn't been migrated.
    #[test]
    fn migrated_users_maps_each_old_id_to_the_latest_id() {
        let mut data = Data::default();
        for i in [2, 5, 7, 8] {
            data.users.add_test_user(User {
                principal: principal(i),
                user_id: user_id(i),
                username: format!("user{i}"),
                ..Default::default()
            });
        }
        data.users.delete_user(user_id(7), 0);
        for (old, new) in [(1, 2), (3, 4), (4, 5), (6, 7)] {
            data.migrated_user_ids.insert(user_id(old), user_id(new));
        }

        let mut result = migrated_users(&data);
        result.sort();

        assert_eq!(
            result,
            vec![
                (principal(2), user_id(1), user_id(2)),
                (principal(5), user_id(3), user_id(5)),
                (principal(5), user_id(4), user_id(5)),
            ]
        );
    }

    fn principal(i: u8) -> Principal {
        Principal::from_slice(&[i, 1])
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }
}
