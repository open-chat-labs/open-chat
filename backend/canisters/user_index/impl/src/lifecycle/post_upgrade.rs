use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, RuntimeState, mutate_state};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{DeleteUser, UserIndexEvent};
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::UserId;
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

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    // Deleting a user pushes events, which makes calls, so it can't be done during the upgrade
    ic_cdk_timers::set_timer(Duration::ZERO, async { mutate_state(delete_users_stuck_on_0_0_0) });
}

// One-off: the canisters of these two users were controlled by others rather than the
// LocalUserIndex until 12 Oct 2026, so they have failed every upgrade (one is stopped, the other is
// running a 0.0.3 wasm), and their migrations are stuck in "requested". Their migrations are
// cancelled, since a user being migrated isn't deleted, and then they are deleted. The
// LocalUserIndex is now a controller of both, so it can uninstall them and refund their cycles.
fn delete_users_stuck_on_0_0_0(state: &mut RuntimeState) {
    for user_id in ["5626j-sqaaa-aaaaf-ay6la-cai", "pa5wn-hqaaa-aaaaf-az7rq-cai"] {
        let user_id: UserId = Principal::from_text(user_id).unwrap().into();

        if let Some(multi_user_canister_id) = state.data.user_migrations.get(&user_id).map(|m| m.multi_user_canister_id) {
            state
                .data
                .user_migrations
                .mark_cancelled(user_id, multi_user_canister_id, None);
        }

        let deleted = state.delete_user(user_id, false);
        if deleted {
            state.push_event_to_all_local_user_indexes(
                UserIndexEvent::DeleteUser(DeleteUser {
                    user_id,
                    #[allow(deprecated)]
                    triggered_by_user: false,
                }),
                None,
            );
        }
        info!(%user_id, deleted, "Deleted user stuck on 0.0.0");
    }
}
