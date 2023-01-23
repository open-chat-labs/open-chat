use crate::lifecycle::{init_state, UPGRADE_BUFFER_SIZE};
use crate::updates::send_message::send_to_recipients_canister;
use crate::Data;
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use std::time::Duration;
use tracing::info;
use types::{Cryptocurrency, LogMessage};
use user_canister::c2c_send_messages::{C2CReplyContext, SendMessageArgs};
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    let logs = log_messages
        .into_iter()
        .map(|l| canister_logger::LogEntry {
            timestamp: l.timestamp,
            message: l.json,
        })
        .collect();
    let traces = trace_messages
        .into_iter()
        .map(|t| canister_logger::LogEntry {
            timestamp: t.timestamp,
            message: t.json,
        })
        .collect();
    canister_logger::init_with_logs(data.test_mode, logs, traces);

    // TODO: This code should be removed after it has been deployed
    data.ledger_canister_ids.insert(
        Cryptocurrency::SNS1,
        Principal::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").expect("Invalid principal"),
    );
    data.ledger_canister_ids.insert(
        Cryptocurrency::CKBTC,
        Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").expect("Invalid principal"),
    );

    for chat in data.direct_chats.iter() {
        let unconfirmed_messages = chat.get_unconfirmed_messages_old();
        if !unconfirmed_messages.is_empty() {
            let messages = unconfirmed_messages
                .into_iter()
                .filter_map(|m| chat.events.main().message_event_by_message_id(m, None))
                .map(|m| SendMessageArgs {
                    message_id: m.event.message_id,
                    sender_message_index: m.event.message_index,
                    content: m.event.content.clone(),
                    replies_to: m.event.replies_to.and_then(|r| {
                        if let Some(chat_id) = r.chat_id_if_other {
                            Some(C2CReplyContext::OtherChat(chat_id, r.event_index))
                        } else {
                            chat.events
                                .main()
                                .message_internal_by_event_index(r.event_index)
                                .map(|m| m.message_id)
                                .map(C2CReplyContext::ThisChat)
                        }
                    }),
                    forwarding: m.event.forwarded,
                    correlation_id: m.correlation_id,
                })
                .collect();

            let them = chat.them;
            let args = user_canister::c2c_send_messages::Args {
                sender_name: data.username.clone(),
                messages,
            };

            ic_cdk::timer::set_timer(Duration::default(), move || {
                ic_cdk::spawn(send_to_recipients_canister(them, args, 0));
            });
        }
    }

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
