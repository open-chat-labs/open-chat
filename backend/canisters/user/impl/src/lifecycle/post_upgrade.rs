use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, mutate_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use installed_bots::BotInternal;
use stable_memory::get_reader;
use tracing::info;
use types::{BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, UserId};
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade(msgpack = true)]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    // TODO: Remove this after next release
    mutate_state(|state| {
        let now = state.env.now();
        let bots: Vec<(UserId, BotInternal)> = state.data.bots.iter().map(|(k, v)| (*k, (*v).clone())).collect();

        for (bot_id, bot) in bots {
            state.push_bot_notification(Some(BotNotification {
                event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
                    installed_by: bot.added_by,
                    location: BotInstallationLocation::Community(state.env.canister_id().into()),
                    granted_command_permissions: bot.permissions,
                    granted_autonomous_permissions: bot.autonomous_permissions.unwrap_or_default(),
                })),
                recipients: vec![bot_id],
                timestamp: now,
            }));
        }
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
