use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{ChitBalance, UserIndexEvent};
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    mutate_state(|state| {
        let users_to_sync: Vec<_> = state
            .data
            .users
            .iter()
            .filter_map(|user| {
                let total_chit_earned = user.total_chit_earned();
                if total_chit_earned != 0 { Some((user.user_id, total_chit_earned)) } else { None }
            })
            .collect();

        for (user_id, total_chit_earned) in users_to_sync {
            state.push_event_to_all_local_user_indexes(
                UserIndexEvent::UpdateChitBalance(
                    user_id,
                    ChitBalance {
                        total_earned: total_chit_earned,
                        curr_balance: total_chit_earned, // We don't yet maintain the users total chit balance
                    },
                ),
                None,
            );
        }
    });
}
