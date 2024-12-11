use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{UserIndexEvent, UserRegistered};
use tracing::info;
use types::{BuildVersion, CanisterId, CanisterWasm};
use user_index_canister::add_local_user_index_canister::{Response::*, *};
use user_index_canister::ChildCanisterType;
use utils::canister::{install_basic, set_controllers};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_local_user_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;

            if let Err(error) = set_controllers(args.canister_id, vec![result.this_canister_id]).await {
                InternalError(format!("Failed to set controller: {error:?}"))
            } else if let Err(error) = install_basic(args.canister_id, result.canister_wasm, result.init_args).await {
                InternalError(format!("Failed to install canister: {error:?}"))
            } else {
                let response = mutate_state(|state| commit(args.canister_id, wasm_version, state));
                info!(canister_id = %args.canister_id, "local user index canister added");
                response
            }
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    this_canister_id: CanisterId,
    canister_wasm: CanisterWasm,
    init_args: local_user_index_canister::init::Args,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.local_index_map.contains_key(&args.canister_id) {
        let canister_wasm = state
            .data
            .child_canister_wasms
            .get(ChildCanisterType::LocalUserIndex)
            .wasm
            .clone();
        let wasm_version = canister_wasm.version;

        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
            canister_wasm,
            init_args: local_user_index_canister::init::Args {
                user_canister_wasm: state.data.child_canister_wasms.get(ChildCanisterType::User).wasm.clone(),
                wasm_version,
                user_index_canister_id: state.env.canister_id(),
                group_index_canister_id: state.data.group_index_canister_id,
                identity_canister_id: state.data.identity_canister_id,
                notifications_canister_id: args.notifications_canister_id,
                proposals_bot_canister_id: state.data.proposals_bot_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                escrow_canister_id: state.data.escrow_canister_id,
                event_relay_canister_id: state.data.event_store_client.info().event_store_canister_id,
                internet_identity_canister_id: state.data.internet_identity_canister_id,
                website_canister_id: state.data.website_canister_id,
                video_call_operators: state.data.video_call_operators.clone(),
                oc_secret_key_der: state
                    .data
                    .oc_key_pair
                    .is_initialised()
                    .then_some(state.data.oc_key_pair.secret_key_der().to_vec()),
                ic_root_key: state.data.ic_root_key.clone(),
                test_mode: state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: BuildVersion, state: &mut RuntimeState) -> Response {
    if state.data.local_index_map.add_index(canister_id, wasm_version) {
        // We need to initialize the new local user index with all the existing users
        for user in state.data.users.iter() {
            state.data.user_index_event_sync_queue.push(
                canister_id,
                UserIndexEvent::UserRegistered(UserRegistered {
                    user_id: user.user_id,
                    user_principal: user.principal,
                    username: user.username.clone(),
                    user_type: user.user_type,
                    referred_by: user.referred_by,
                }),
            )
        }
        crate::jobs::sync_events_to_local_user_index_canisters::try_run_now(state);

        Success
    } else {
        AlreadyAdded
    }
}
