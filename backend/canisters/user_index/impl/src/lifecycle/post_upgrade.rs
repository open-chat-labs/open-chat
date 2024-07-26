use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{jobs, mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::UserRegistered;
use stable_memory::get_reader;
use tracing::info;
use types::UserType;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    mutate_state(|state| {
        // TODO: remove this one-time only code
        if state.data.test_mode {
            state.data.airdrop_bot_canister_id = Principal::from_text("6pwwx-laaaa-aaaaf-bmy6a-cai").unwrap();
        }

        let events = [
            local_user_index_canister::Event::UserRegistered(UserRegistered {
                user_id: state.data.proposals_bot_canister_id.into(),
                user_principal: state.data.proposals_bot_canister_id,
                username: "ProposalsBot".to_string(),
                is_bot: true,
                user_type: UserType::OcControlledBot,
                referred_by: None,
            }),
            local_user_index_canister::Event::UserRegistered(UserRegistered {
                user_id: state.data.airdrop_bot_canister_id.into(),
                user_principal: state.data.airdrop_bot_canister_id,
                username: "AirdropBot".to_string(),
                is_bot: true,
                user_type: UserType::OcControlledBot,
                referred_by: None,
            }),
        ];

        for canister_id in state.data.local_index_map.canisters() {
            for event in events.iter() {
                state.data.user_index_event_sync_queue.push(*canister_id, event.clone());
            }
        }
        jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
