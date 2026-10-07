use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::collections::BTreeSet;
use std::time::Duration;
use tracing::info;
use types::{BotInstallationLocation, BotRegistrationStatus, UserId};
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

    // One-off: point the new queue of migrated user ids at the StorageIndex, and queue every user
    // migrated so far, so that the storage buckets replace their old ids with their new ones among
    // the accessors of their files. Each old id is paired with the user's latest id, so it doesn't
    // matter in which order they're applied. They're queued from a timer because pushing to the
    // queue makes c2c calls.
    // TODO remove after the release containing this has been deployed
    mutate_state(|state| {
        let storage_index_canister_id = state.data.storage_index_canister_id;
        state
            .data
            .storage_index_user_ids_migrated_queue
            .set_state(storage_index_canister_id);
    });
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        mutate_state(|state| {
            let migrated_user_ids = &state.data.migrated_user_ids;
            let user_ids = migrated_user_ids
                .iter()
                .map(|(old_user_id, _)| (old_user_id, migrated_user_ids.latest(old_user_id)))
                .collect();
            state.data.storage_index_user_ids_migrated_queue.push_many(user_ids);
        });
    });

    // One-off: move the bots installed in the direct chats of users migrated so far, or only permitted
    // to be, from their old ids onto their latest ones, with the LocalUserIndex holding them as each
    // bot's gateway, which tells each bot. Run from a timer because telling them makes c2c calls.
    // TODO remove after the release containing this has been deployed
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        mutate_state(|state| {
            let migrated_user_ids = &state.data.migrated_user_ids;
            let user_ids: BTreeSet<(UserId, UserId)> = state
                .data
                .users
                .iter_bots()
                .flat_map(|(_, bot)| {
                    let permitted_location = match bot.registration_status {
                        BotRegistrationStatus::Private(location) => location,
                        BotRegistrationStatus::Public => None,
                    };
                    bot.installations.keys().copied().chain(permitted_location)
                })
                .filter_map(|location| match location {
                    BotInstallationLocation::User(chat_id) => {
                        let user_id = UserId::from(chat_id);
                        let latest = migrated_user_ids.latest(user_id);
                        (latest != user_id).then_some((user_id, latest))
                    }
                    BotInstallationLocation::Group(_) | BotInstallationLocation::Community(_) => None,
                })
                .collect();
            info!(
                users = user_ids.len(),
                "Moving bot installations of migrated users onto their latest ids"
            );
            for (old_user_id, new_user_id) in user_ids {
                state.migrate_bot_installations(old_user_id, new_user_id);
            }
        });
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
