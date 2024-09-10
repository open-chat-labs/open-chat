use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{jobs, mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{DiamondMembershipPaymentReceived, Event as LocalUserIndexEvent};
use stable_memory::get_reader;
use tracing::info;
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

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        for user in state.data.users.iter().filter(|u| u.referred_by.is_some()) {
            let is_lifetime_diamond_member = user.diamond_membership_details.is_lifetime_diamond_member();

            let mut event = None;
            if let Some(proof) = user.unique_person_proof.as_ref().filter(|_| !is_lifetime_diamond_member) {
                event = Some(LocalUserIndexEvent::NotifyUniquePersonProof(user.user_id, proof.clone()));
            } else if let Some(payment) = user.diamond_membership_details.payments().last() {
                event = Some(LocalUserIndexEvent::DiamondMembershipPaymentReceived(
                    DiamondMembershipPaymentReceived {
                        user_id: user.user_id,
                        timestamp: payment.timestamp,
                        expires_at: user.diamond_membership_details.expires_at().unwrap(),
                        token: payment.token.clone(),
                        amount_e8s: payment.amount_e8s,
                        block_index: payment.block_index,
                        duration: payment.duration,
                        recurring: user.diamond_membership_details.is_recurring(),
                        send_bot_message: false,
                    },
                ));
            }
            if let Some(event) = event {
                if let Some(index) = state.data.local_index_map.get_index_canister(&user.user_id) {
                    state.data.user_index_event_sync_queue.push(index, event);
                }
            }
        }

        jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    });
}
