use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{mutate_state, Data, LOG_MESSAGES};
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use tracing::info;
use types::{UserEvent, UsernameChanged};
use user_index_canister::post_upgrade::Args;
use utils::consts::MIN_CYCLES_BALANCE;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages, cycles_dispenser_client_state): (
        Data,
        Vec<LogMessage>,
        Vec<LogMessage>,
        Vec<u8>,
    ) = deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    data.users.rehydrate();

    init_logger(data.test_mode);
    init_state(env, data, args.wasm_version);

    if !log_messages.is_empty() || !trace_messages.is_empty() {
        LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
    }

    cycles_dispenser_client::init_from_bytes(&cycles_dispenser_client_state);
    cycles_dispenser_client::set_min_cycles_balance(3 * MIN_CYCLES_BALANCE / 2);

    mutate_state(|state| {
        let scam_usernames = ["SNS1Bot", "SNS1_B0T"];
        let now = state.env.now();
        for username in scam_usernames {
            if let Some(user) = state.data.users.get_by_username(username) {
                info!(?user, "Updating user");
                let user_id = user.user_id;

                let mut clone = user.clone();
                let new_username = clone.username + "_(SCAM!)";
                clone.username = new_username.clone();
                clone.date_updated = now;

                state.data.users.update(clone);
                state.data.user_event_sync_queue.push(
                    user_id,
                    UserEvent::UsernameChanged(UsernameChanged { username: new_username }),
                );
            }
        }
    });

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
