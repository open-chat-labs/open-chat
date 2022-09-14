use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{mutate_state, Data, RuntimeState, LOG_MESSAGES};
use candid::Principal;
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use std::collections::HashSet;
use tracing::info;
use types::{ParticipantLeft, UserId};
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

    mutate_state(|state| remove_invalid_users(state, state.data.test_mode));

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

fn rehydrate_log_messages(
    log_messages: Vec<LogMessage>,
    trace_messages: Vec<LogMessage>,
    messages_container: &LogMessagesWrapper,
) {
    for message in log_messages {
        messages_container.logs.push(message);
    }

    for message in trace_messages {
        messages_container.traces.push(message);
    }
}

fn remove_invalid_users(runtime_state: &mut RuntimeState, test_mode: bool) {
    let test_users = test_users();

    let to_remove: Vec<UserId> = runtime_state
        .data
        .participants
        .iter()
        .filter(|u| test_users.contains(&u.user_id) != test_mode)
        .map(|u| u.user_id)
        .collect();

    if !to_remove.is_empty() {
        info!(?to_remove, "Removing invalid users");

        for user_id in to_remove {
            remove_user(user_id, runtime_state);
        }
    }
}

fn remove_user(user_id: UserId, runtime_state: &mut RuntimeState) {
    runtime_state.data.participants.remove(user_id);

    let event = ParticipantLeft { user_id };

    runtime_state
        .data
        .events
        .push_main_event(ChatEventInternal::ParticipantLeft(Box::new(event)), runtime_state.env.now());
}

fn test_users() -> HashSet<UserId> {
    HashSet::from_iter([
        Principal::from_text("7m3yl-syaaa-aaaaf-ap4va-cai").unwrap().into(),
        Principal::from_text("nb6hs-saaaa-aaaaf-amdsa-cai").unwrap().into(),
        Principal::from_text("mvayu-2yaaa-aaaaf-ahdta-cai").unwrap().into(),
        Principal::from_text("y4oz3-caaaa-aaaaf-aczsa-cai").unwrap().into(),
        Principal::from_text("suvcm-lqaaa-aaaaf-ahgda-cai").unwrap().into(),
        Principal::from_text("ju7sa-eaaaa-aaaaf-anbsq-cai").unwrap().into(),
        Principal::from_text("6sbqt-vyaaa-aaaaf-ab2gq-cai").unwrap().into(),
        Principal::from_text("m4dti-mqaaa-aaaaf-ahdsq-cai").unwrap().into(),
        Principal::from_text("ng7bg-7yaaa-aaaaf-amdsq-cai").unwrap().into(),
        Principal::from_text("ot4pu-taaaa-aaaaf-adyqq-cai").unwrap().into(),
        Principal::from_text("ut64j-daaaa-aaaaf-ahkza-cai").unwrap().into(),
        Principal::from_text("j54z4-siaaa-aaaaf-anbta-cai").unwrap().into(),
        Principal::from_text("o27ei-fiaaa-aaaaf-adyra-cai").unwrap().into(),
        Principal::from_text("yjjiw-diaaa-aaaaf-aczrq-cai").unwrap().into(),
        Principal::from_text("6vawh-yaaaa-aaaaf-ab2ga-cai").unwrap().into(),
        Principal::from_text("u25xv-viaaa-aaaaf-ahkyq-cai").unwrap().into(),
        Principal::from_text("n6o55-uqaaa-aaaaf-alqmq-cai").unwrap().into(),
        Principal::from_text("63c3p-dqaaa-aaaaf-ab2ha-cai").unwrap().into(),
        Principal::from_text("o56c4-iqaaa-aaaaf-adyrq-cai").unwrap().into(),
        Principal::from_text("nuzw7-tiaaa-aaaaf-amdrq-cai").unwrap().into(),
        Principal::from_text("nxnwb-cyaaa-aaaaf-alqna-cai").unwrap().into(),
        Principal::from_text("j2mys-laaaa-aaaaf-acwva-cai").unwrap().into(),
        Principal::from_text("uu725-oyaaa-aaaaf-ahkzq-cai").unwrap().into(),
        Principal::from_text("yoioc-oqaaa-aaaaf-aczra-cai").unwrap().into(),
        Principal::from_text("64d53-oiaaa-aaaaf-ab2hq-cai").unwrap().into(),
        Principal::from_text("jtpto-5iaaa-aaaaf-acwuq-cai").unwrap().into(),
        Principal::from_text("4b6tt-5aaaa-aaaaf-ab2ia-cai").unwrap().into(),
        Principal::from_text("nzp3j-ziaaa-aaaaf-alqma-cai").unwrap().into(),
        Principal::from_text("jt6uu-jyaaa-aaaaf-anbsa-cai").unwrap().into(),
        Principal::from_text("stuey-giaaa-aaaaf-ahgdq-cai").unwrap().into(),
        Principal::from_text("y3p7p-pyaaa-aaaaf-aczsq-cai").unwrap().into(),
        Principal::from_text("msb6a-xaaaa-aaaaf-ahdtq-cai").unwrap().into(),
        Principal::from_text("yhlf6-yyaaa-aaaaf-aczqq-cai").unwrap().into(),
    ])
}
