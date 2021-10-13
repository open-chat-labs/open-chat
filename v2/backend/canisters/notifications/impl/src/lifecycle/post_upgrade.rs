use crate::lifecycle::{init_logger, init_state};
use crate::{Data, StateVersion, LOG_MESSAGES};
use canister_logger::{LogMessage, LogMessagesWrapper};
use ic_cdk_macros::post_upgrade;
use tracing::{info, instrument};
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[instrument(level = "trace")]
fn post_upgrade() {
    ic_cdk::setup();

    let (version, bytes): (StateVersion, Vec<u8>) = ic_cdk::storage::stable_restore().unwrap();
    let env = Box::new(CanisterEnv::new());

    match version {
        StateVersion::V1 => {
            let (data_bytes, log_messages_bytes): (Vec<u8>, Vec<u8>) = candid::decode_args(&bytes).unwrap();

            let data: Data = candid::decode_one(&data_bytes).unwrap();
            let (log_messages, trace_messages): (Vec<LogMessage>, Vec<LogMessage>) =
                candid::decode_args(&log_messages_bytes).unwrap();

            init_logger(data.test_mode);
            init_state(env, data);

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
    for message in log_messages.into_iter() {
        messages_container.logs.push(message);
    }

    for message in trace_messages.into_iter() {
        messages_container.traces.push(message);
    }
}
