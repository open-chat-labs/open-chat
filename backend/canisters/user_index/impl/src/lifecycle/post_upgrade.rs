use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::updates::pay_for_diamond_membership::PayForDiamondMembershipEventPayload;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use event_sink_client::Event;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
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
    });

    ic_cdk_timers::set_timer(Duration::ZERO, push_diamond_membership_payment_events);
}

fn push_diamond_membership_payment_events() {
    mutate_state(|state| {
        let source = Some(state.env.canister_id().to_text());

        let previous_upgrade = 1707844764000;
        let events = state.data.users.iter().flat_map(|u| {
            u.diamond_membership_details
                .payments()
                .iter()
                .filter(|p| p.timestamp < previous_upgrade)
                .map(|p| Event {
                    name: "diamond_membership_payment".to_string(),
                    timestamp: p.timestamp,
                    user: Some(u.user_id.to_string()),
                    source: source.clone(),
                    payload: serde_json::to_vec(&PayForDiamondMembershipEventPayload {
                        token: p.token.token_symbol().to_string(),
                        amount: p.amount_e8s,
                        duration: p.duration.to_string(),
                        recurring: u.diamond_membership_details.is_recurring(),
                        manual_payment: p.manual_payment,
                    })
                    .unwrap(),
                })
        });

        state.data.event_sink_client.push_many(events);
    });
}
