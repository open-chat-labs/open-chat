use crate::lifecycle::init_state;
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::{error, info};
use user_index_canister::migrated_user_ids;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    // TODO remove after the release containing this has been deployed
    // Looking up the users' latest ids is a call to the UserIndex, so can't be done during the upgrade
    ic_cdk_timers::set_timer(Duration::ZERO, async { replace_old_user_ids_in_descriptions() });
}

// One-off: the descriptions of public groups and communities, which the explore page shows, are held
// here as each group or community last sent them, which the jobs replacing the ids users had before
// being migrated to a MultiUser canister with their latest ids don't reach. So mentions of users by
// those ids are replaced here, by the latest ids the UserIndex has for them. Retried after a minute
// if the UserIndex can't be called.
fn replace_old_user_ids_in_descriptions() {
    utils::async_work::spawn_tracked(replace_old_user_ids_in_descriptions_inner());

    async fn replace_old_user_ids_in_descriptions_inner() {
        let (user_index_canister_id, user_ids) = read_state(|state| {
            (
                state.data.user_index_canister_id,
                state.data.unindexed_user_ids_mentioned_in_descriptions(),
            )
        });
        if user_ids.is_empty() {
            return;
        }

        let args = migrated_user_ids::Args { user_ids };
        match user_index_canister_c2c_client::migrated_user_ids(user_index_canister_id, &args).await {
            Ok(migrated_user_ids::Response::Success(latest_user_ids)) => {
                let descriptions_updated =
                    mutate_state(|state| state.data.replace_users_mentioned_in_descriptions(&latest_user_ids));
                info!(
                    looked_up = args.user_ids.len(),
                    migrated = latest_user_ids.len(),
                    descriptions_updated,
                    "Replaced old user ids mentioned in descriptions"
                );
            }
            Err(error) => {
                error!(?error, "Failed to look up migrated users' ids, will retry");
                ic_cdk_timers::set_timer(Duration::from_secs(60), async { replace_old_user_ids_in_descriptions() });
            }
        }
    }
}
