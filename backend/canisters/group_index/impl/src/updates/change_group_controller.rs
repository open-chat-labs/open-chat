use crate::guards::caller_is_controller;
use crate::read_state;
use canister_tracing_macros::trace;
use group_index_canister::add_local_group_index_canister::{Response::*, *};
use ic_cdk_macros::update;
use tracing::error;
use utils::canister::update_settings;

#[update(guard = "caller_is_controller")]
#[trace]
async fn change_group_controller(_args: Args) -> Response {
    let (groups, local_group_index_canister_id) = read_state(|state| {
        let private_groups = state.data.private_groups.iter().map(|g| g.id());
        let public_groups = state.data.public_groups.iter().map(|g| g.id());
        let all_groups: Vec<_> = private_groups.chain(public_groups).collect();
        let local_group_index_canister_id = *state
            .data
            .local_index_map
            .canisters()
            .next()
            .expect("local_index_map should not be empty");
        (all_groups, local_group_index_canister_id)
    });

    for canister_id in groups {
        match update_settings(canister_id.into(), vec![local_group_index_canister_id]).await {
            Ok(_) => (),
            Err(error) => {
                error!(?error, "Error calling management_canister::update_settings");
                return InternalError(format!("{:?}", error));
            }
        }
    }

    Success
}
