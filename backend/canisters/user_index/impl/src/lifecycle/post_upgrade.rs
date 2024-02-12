use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data, UserRegisteredEventPayload};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    // Post upgrade - remove
    mutate_state(|state| {
        if !state.data.legacy_principals_synced && state.data.test_mode {
            state.data.legacy_principals_synced = true;
            state
                .data
                .legacy_principals_sync_queue
                .extend(state.data.users.iter().map(|u| u.principal));

            crate::jobs::sync_legacy_user_principals::start_job_if_required(state);
        }

        let source = Some(state.env.canister_id().to_text());

        // Push an event for each user who registered before the previous upgrade
        for user in state.data.users.iter().filter(|u| u.date_created < 1707486762394) {
            let payload = serde_json::to_vec(&UserRegisteredEventPayload {
                referred: user.referred_by.is_some(),
                is_bot: user.is_bot,
            })
            .unwrap();

            state.data.event_sink_client.push_event(event_sink_client::Event {
                name: "user_registered".to_string(),
                timestamp: user.date_created,
                user: Some(user.user_id.to_string()),
                source: source.clone(),
                payload,
            });
        }
    });
}
