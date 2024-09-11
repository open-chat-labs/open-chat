use std::collections::HashSet;

use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::user::User;
use crate::{jobs, mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{Event as LocalUserIndexEvent, OpenChatBotMessageV2};
use stable_memory::get_reader;
use tracing::info;
use types::{MessageContentInitial, Milliseconds, TextContent, TimestampMillis, UserId};
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    // TODO: delete after release
    queue_oc_bot_messages_with_survey_link();

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

fn queue_oc_bot_messages_with_survey_link() {
    mutate_state(|state| {
        const MONTH_IN_MS: Milliseconds = ((4 * 365) + 1) * 24 * 60 * 60 * 1000 / (4 * 12);
        let now = state.env.now();

        for user in state
            .data
            .users
            .iter()
            .filter(|u| is_user_in_cohort(u, now - MONTH_IN_MS, now))
        {
            if let Some(canister_id) = state.data.local_index_map.get_index_canister(&user.user_id) {
                let event = build_oc_bot_message(user);
                state.data.user_index_event_sync_queue.push(canister_id, event);
                state.data.survey_messages_sent += 1;
            }
        }

        jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    });
}

fn is_user_in_cohort(user: &User, registered_from: TimestampMillis, registered_to: TimestampMillis) -> bool {
    let test_users: HashSet<UserId> = [
        "rozjf-eqaaa-aaaar-amxpq-cai",
        "27eue-hyaaa-aaaaf-aaa4a-cai",
        "v3qt2-6qaaa-aaaaf-biftq-cai",
    ]
    .into_iter()
    .map(|t| Principal::from_text(t).unwrap().into())
    .collect();

    test_users.contains(&user.user_id)
        || (user.total_chit_earned() >= 5000 && (user.date_created >= registered_from && user.date_created < registered_to))
}

fn build_oc_bot_message(user: &User) -> LocalUserIndexEvent {
    let text = format!("We would like to hear more about your experiences and usage of OpenChat and the IC (Internet Computer). 
Your feedback will help us improve our service and better meet your needs.

[Survey link (Google Forms)](https://docs.google.com/forms/d/e/1FAIpQLSe_o_gpIi-ln_7Q6Us25_7r98TSlR2D7f9FnzDPyXVwncsm7A/viewform?usp=pp_url&entry.913893165={})
", user.user_id);

    LocalUserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
        user_id: user.user_id,
        thread_root_message_id: None,
        content: MessageContentInitial::Text(TextContent { text }),
        mentioned: Vec::new(),
    }))
}
