use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::OPENCHAT_BOT_USER_ID;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_canister::post_upgrade::Args;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let oc_controlled_bots = [
        OPENCHAT_BOT_USER_ID,                                                // OC Bot
        Principal::from_text("62rh2-kiaaa-aaaaf-bmy5q-cai").unwrap().into(), // AirdropBot
        Principal::from_text("iywa7-ayaaa-aaaaf-aemga-cai").unwrap().into(), // ProposalsBot
    ];

    mutate_state(|state| {
        for chat in state.data.direct_chats.iter_mut() {
            chat.events.populate_search_index();
        }

        state
            .data
            .direct_chats
            .set_user_type_for_oc_controlled_bots(&oc_controlled_bots);
    });
}
