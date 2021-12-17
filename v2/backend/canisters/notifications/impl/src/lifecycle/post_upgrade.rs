use crate::lifecycle::{init_logger, init_state};
use crate::{Data, StateVersion, LOG_MESSAGES};
use canister_api_macros::trace;
use canister_logger::{set_panic_hook, LogMessage, LogMessagesWrapper};
use ic_cdk_macros::post_upgrade;
use notifications_canister::post_upgrade::Args;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    set_panic_hook();

    let (version, bytes): (StateVersion, Vec<u8>) = ic_cdk::storage::stable_restore().unwrap();
    let env = Box::new(CanisterEnv::new());

    match version {
        StateVersion::V1 => {
            let (data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
                serializer::deserialize(&bytes).unwrap();

            init_logger(data.test_mode);
            init_state(env, data, args.wasm_version);

            if !log_messages.is_empty() || !trace_messages.is_empty() {
                LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
            }
        }
    };

    info!("Post-upgrade complete");
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
