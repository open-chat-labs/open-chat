use crate::lifecycle::{init_logger, init_state};
use crate::{Data, StateVersion, LOG_MESSAGES};
use ic_cdk_macros::post_upgrade;
use tracing::info;
use utils::canister_logger::{LogMessage, LogMessagesContainer};
use utils::env::canister::CanisterEnv;

#[post_upgrade]
fn post_upgrade() {
    init_logger();
    ic_cdk::setup();

    let (version, bytes): (StateVersion, Vec<u8>) = ic_cdk::storage::stable_restore().unwrap();
    let env = Box::new(CanisterEnv::new(false));

    match version {
        StateVersion::V1 => {
            let (data_bytes, log_messages_bytes): (Vec<u8>, Vec<u8>) = candid::decode_args(&bytes).unwrap();

            let data: Data = candid::decode_one(&data_bytes).unwrap();
            let log_messages: Vec<LogMessage> = candid::decode_one(&log_messages_bytes).unwrap();

            init_state(env, data);

            if !log_messages.is_empty() {
                LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, &l.borrow()))
            }
        }
    };

    info!("Post-upgrade complete");
}

fn rehydrate_log_messages(log_messages: Vec<LogMessage>, messages_container: &LogMessagesContainer) {
    for message in log_messages.into_iter() {
        messages_container.push(message);
    }
}
