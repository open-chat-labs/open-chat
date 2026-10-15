use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{Data, mutate_state, read_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::{error, info};
use translations_canister::post_upgrade::Args;
use user_index_canister::migrated_user_ids;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    // Looking up the users' latest ids is a call to the UserIndex, so can't be done during the upgrade
    ic_cdk_timers::set_timer(Duration::ZERO, async { rewrite_migrated_user_ids() });
}

// One-off: users who proposed or decided on translations before being migrated to a MultiUser canister
// are stored under their old ids, so the proposer was paid at their old User canister's wallet, and
// wasn't matched with their latest id when overriding their proposals or checking whether they've
// been paid for a record already. So each id is rewritten to the user's latest id. Only ids which the
// UserIndex has a migration for are rewritten, since the rest, eg. legacy ids or those of bots, are
// current. Retried after a minute if the UserIndex can't be called.
fn rewrite_migrated_user_ids() {
    ic_cdk::futures::spawn_migratory(rewrite_migrated_user_ids_inner());

    async fn rewrite_migrated_user_ids_inner() {
        let (user_index_canister_id, user_ids) = read_state(|state| {
            (
                state.data.user_index_canister_id,
                state.data.translations.user_ids_without_index(),
            )
        });
        if user_ids.is_empty() {
            return;
        }

        let args = migrated_user_ids::Args { user_ids };
        match user_index_canister_c2c_client::migrated_user_ids(user_index_canister_id, &args).await {
            Ok(migrated_user_ids::Response::Success(latest_user_ids)) => {
                let (rewritten, overridden) = mutate_state(|state| {
                    let rewritten = state.data.translations.rewrite_user_ids(&latest_user_ids);
                    let overridden = state.data.translations.override_superseded_proposals();
                    (rewritten, overridden)
                });
                info!(
                    looked_up = args.user_ids.len(),
                    migrated = latest_user_ids.len(),
                    rewritten,
                    overridden,
                    "Rewrote migrated users' ids"
                );
            }
            Err(error) => {
                error!(?error, "Failed to look up migrated users' ids, will retry");
                ic_cdk_timers::set_timer(Duration::from_secs(60), async { rewrite_migrated_user_ids() });
            }
        }
    }
}
