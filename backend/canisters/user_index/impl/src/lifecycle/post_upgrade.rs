use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{UserDetailsFull, UserIndexEvent};
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    let new_local_user_index = CanisterId::from_text("lyt4m-myaaa-aaaac-aadkq-cai").unwrap();
    if data.local_index_map.contains_key(&new_local_user_index) {
        for user in data.users.iter() {
            data.user_index_event_sync_queue.push(
                new_local_user_index,
                UserIndexEvent::SyncExistingUser(UserDetailsFull {
                    user_id: user.user_id,
                    user_principal: user.principal,
                    username: user.username.clone(),
                    user_type: user.user_type,
                    referred_by: user.referred_by,
                    is_platform_moderator: data.platform_moderators.contains(&user.user_id),
                    diamond_membership_expires_at: user.diamond_membership_details.expires_at(),
                    unique_person_proof: user.unique_person_proof.clone(),
                }),
            )
        }
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
