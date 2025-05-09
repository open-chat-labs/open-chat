use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{BotUpdated, UserIndexEvent};
use stable_memory::get_reader;
use tracing::info;
use types::BotDefinition;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    for (bot_id, bot) in data.users.iter_bots() {
        for canister_id in data.local_index_map.canisters() {
            data.user_index_event_sync_queue.push(
                *canister_id,
                UserIndexEvent::BotUpdated(BotUpdated {
                    bot_id: *bot_id,
                    owner_id: bot.owner,
                    endpoint: bot.endpoint.clone(),
                    definition: BotDefinition {
                        description: bot.description.clone(),
                        commands: bot.commands.clone(),
                        autonomous_config: bot.autonomous_config.clone(),
                    },
                }),
            );
        }
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
