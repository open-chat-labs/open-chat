use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::timer_job_types::{MarkVideoCallEndedJob, TimerJob};
use crate::{mutate_state, read_state, Data, RuntimeState};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, MessageContentInternal, Reader, OPENCHAT_BOT_USER_ID};
use event_store_producer::{Event, EventBuilder};
use group_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use std::collections::HashMap;
use tracing::info;
use types::{
    CanisterId, MessageEditedEventPayload, MessageEventPayload, MessageTippedEventPayload, P2PSwapCompletedEventPayload,
    P2PSwapStatus, ReactionAddedEventPayload, VideoCallEndedEventPayload,
};
use utils::time::HOUR_IN_MS;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    let token_lookup: HashMap<_, _> = vec![
        (CanisterId::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(), "ICP"),
        (CanisterId::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").unwrap(), "DKP"),
        (CanisterId::from_text("2ouva-viaaa-aaaaq-aaamq-cai").unwrap(), "CHAT"),
        (CanisterId::from_text("73mez-iiaaa-aaaaq-aaasq-cai").unwrap(), "KINIC"),
        (CanisterId::from_text("6rdgd-kyaaa-aaaaq-aaavq-cai").unwrap(), "HOT"),
        (CanisterId::from_text("4c4fd-caaaa-aaaaq-aaa3a-cai").unwrap(), "GHOST"),
        (CanisterId::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap(), "ckBTC"),
        (CanisterId::from_text("xsi2v-cyaaa-aaaaq-aabfq-cai").unwrap(), "MOD"),
        (CanisterId::from_text("uf2wh-taaaa-aaaaq-aabna-cai").unwrap(), "CAT"),
        (CanisterId::from_text("vtrom-gqaaa-aaaaq-aabia-cai").unwrap(), "BOOM"),
        (CanisterId::from_text("rffwt-piaaa-aaaaq-aabqq-cai").unwrap(), "ICX"),
        (CanisterId::from_text("rxdbk-dyaaa-aaaaq-aabtq-cai").unwrap(), "NUA"),
        (CanisterId::from_text("qbizb-wiaaa-aaaaq-aabwq-cai").unwrap(), "SONIC"),
        (CanisterId::from_text("6qfxa-ryaaa-aaaai-qbhsq-cai").unwrap(), "TAGGR"),
        (CanisterId::from_text("rh2pm-ryaaa-aaaan-qeniq-cai").unwrap(), "EXE"),
        (CanisterId::from_text("ss2fx-dyaaa-aaaar-qacoq-cai").unwrap(), "ckETH"),
        (CanisterId::from_text("iozql-7iaaa-aaaah-advvq-cai").unwrap(), "TENDY"),
        (CanisterId::from_text("emww2-4yaaa-aaaaq-aacbq-cai").unwrap(), "TRAX"),
        (CanisterId::from_text("f54if-eqaaa-aaaaq-aacea-cai").unwrap(), "NTN"),
        (CanisterId::from_text("tyyy3-4aaaa-aaaaq-aab7a-cai").unwrap(), "GLDGov"),
        (CanisterId::from_text("ifnqy-rqaaa-aaaak-afhmq-cai").unwrap(), "ICPI"),
        (CanisterId::from_text("pcj6u-uaaaa-aaaak-aewnq-cai").unwrap(), "CLOUD"),
        (CanisterId::from_text("3kf65-giaaa-aaaak-qcw2q-cai").unwrap(), "AVCD"),
        (CanisterId::from_text("7tx3o-zyaaa-aaaak-aes6q-cai").unwrap(), "DOGMI"),
        (CanisterId::from_text("uxr6i-cyaaa-aaaar-qacyq-cai").unwrap(), "TTS"),
        (CanisterId::from_text("wnnwu-4iaaa-aaaar-qacxq-cai").unwrap(), "SKIBIDI"),
        (CanisterId::from_text("vpyll-myaaa-aaaar-qac4q-cai").unwrap(), "HAR"),
        (CanisterId::from_text("jwcfb-hyaaa-aaaaj-aac4q-cai").unwrap(), "OGY"),
        (CanisterId::from_text("edypu-bqaaa-aaaak-afknq-cai").unwrap(), "BITCORN"),
        (CanisterId::from_text("hvgxa-wqaaa-aaaaq-aacia-cai").unwrap(), "SNEED"),
        (CanisterId::from_text("uwihq-liaaa-aaaal-qcbrq-cai").unwrap(), "NOBL"),
        (CanisterId::from_text("ek3ei-xyaaa-aaaak-afkma-cai").unwrap(), "DIZNI"),
        (CanisterId::from_text("hhaaz-2aaaa-aaaaq-aacla-cai").unwrap(), "ICL"),
        (CanisterId::from_text("gemj7-oyaaa-aaaaq-aacnq-cai").unwrap(), "ELNA"),
    ]
    .into_iter()
    .collect();

    mutate_state(|state| {
        let events = extract_events(state, &token_lookup);
        state.data.event_store_client.push_many(events.into_iter(), false);

        let now = state.env.now();
        if state.data.chat.events.video_call_in_progress.timestamp < now.saturating_sub(HOUR_IN_MS) {
            if let Some(message_id) = state
                .data
                .chat
                .events
                .video_call_in_progress
                .value
                .as_ref()
                .map(|vc| vc.message_index)
                .and_then(|index| {
                    state
                        .data
                        .chat
                        .events
                        .main_events_reader()
                        .message_internal(index.into())
                        .map(|m| m.message_id)
                })
            {
                state.data.timer_jobs.enqueue_job(
                    TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob(group_canister::end_video_call::Args { message_id })),
                    now,
                    now,
                );
            }
        }
    });
}

fn extract_events(state: &RuntimeState, token_lookup: &HashMap<CanisterId, &str>) -> Vec<Event> {
    let this_canister_id_string = state.env.canister_id().to_string();
    let this_canister_id_str = this_canister_id_string.as_str();
    let anonymized_chat_id = state.data.chat.events.anonymized_id.clone();
    let proposals_bot_user_id = state.data.proposals_bot_user_id;

    state
        .data
        .chat
        .events
        .iter_all_events()
        .flat_map(move |(e, is_thread)| {
            let mut events = Vec::new();
            if let ChatEventInternal::Message(m) = &e.event {
                let sender_is_bot = m.sender == proposals_bot_user_id || m.sender == OPENCHAT_BOT_USER_ID;
                events.push(
                    EventBuilder::new("message_sent", e.timestamp)
                        .with_user(m.sender.to_string(), true)
                        .with_source(this_canister_id_str, true)
                        .with_json_payload(&MessageEventPayload {
                            message_type: m.content.message_type(),
                            chat_type: "group".to_string(),
                            chat_id: anonymized_chat_id.clone(),
                            thread: is_thread,
                            sender_is_bot,
                            content_specific_payload: m.content.event_payload(),
                        })
                        .build(),
                );

                for (ledger, tips) in m.tips.iter() {
                    let token = token_lookup.get(ledger).unwrap();
                    for (user_id, amount) in tips.iter() {
                        events.push(
                            EventBuilder::new("message_tipped", e.timestamp)
                                .with_user(user_id.to_string(), true)
                                .with_source(this_canister_id_str, true)
                                .with_json_payload(&MessageTippedEventPayload {
                                    message_type: m.content.message_type(),
                                    chat_type: "group".to_string(),
                                    chat_id: anonymized_chat_id.clone(),
                                    thread: is_thread,
                                    token: token.to_string(),
                                    amount: *amount,
                                })
                                .build(),
                        );
                    }
                }

                for (_, user_ids) in m.reactions.iter() {
                    for user_id in user_ids {
                        events.push(
                            EventBuilder::new("reaction_added", e.timestamp)
                                .with_user(user_id.to_string(), true)
                                .with_source(this_canister_id_str, true)
                                .with_json_payload(&ReactionAddedEventPayload {
                                    message_type: m.content.message_type(),
                                    chat_type: "group".to_string(),
                                    chat_id: anonymized_chat_id.clone(),
                                    thread: is_thread,
                                })
                                .build(),
                        );
                    }
                }

                if m.last_edited.is_some() {
                    events.push(
                        EventBuilder::new("message_edited", e.timestamp)
                            .with_user(m.sender.to_string(), true)
                            .with_source(this_canister_id_str, true)
                            .with_json_payload(&MessageEditedEventPayload {
                                message_type: m.content.message_type(),
                                chat_type: "group".to_string(),
                                chat_id: anonymized_chat_id.clone(),
                                thread: is_thread,
                                already_edited: false, // We can't determine this
                                old_length: 0,         // We can't determine this
                                new_length: m.content.text_length(),
                            })
                            .build(),
                    );
                }

                if let MessageContentInternal::VideoCall(video) = &m.content {
                    if let Some(ts) = video.ended {
                        events.push(
                            EventBuilder::new("video_call_ended", e.timestamp)
                                .with_source(this_canister_id_str, true)
                                .with_json_payload(&VideoCallEndedEventPayload {
                                    chat_type: "group".to_string(),
                                    chat_id: anonymized_chat_id.clone(),
                                    participants: video.participants.len() as u32,
                                    duration_secs: (ts.saturating_sub(e.timestamp) / 1000) as u32,
                                })
                                .build(),
                        );
                    }
                }

                if let MessageContentInternal::P2PSwap(swap) = &m.content {
                    if let P2PSwapStatus::Completed(c) = &swap.status {
                        events.push(
                            EventBuilder::new("p2p_swap_completed", e.timestamp)
                                .with_user(c.accepted_by.to_string(), true)
                                .with_source(this_canister_id_str, true)
                                .with_json_payload(&P2PSwapCompletedEventPayload {
                                    token0: swap.token0.token.token_symbol().to_string(),
                                    token0_amount: swap.token0_amount,
                                    token1: swap.token1.token.token_symbol().to_string(),
                                    token1_amount: swap.token1_amount,
                                    chat_type: "group".to_string(),
                                    chat_id: anonymized_chat_id.clone(),
                                })
                                .build(),
                        );
                    }
                }
            }
            events
        })
        .collect()
}
