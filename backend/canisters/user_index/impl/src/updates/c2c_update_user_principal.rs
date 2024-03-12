use crate::guards::caller_is_identity_canister;
use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::Event;
use types::{CanisterId, UpdateUserPrincipalArgs, UserId};
use user_index_canister::c2c_update_user_principal::{Response::*, *};

#[update_msgpack(guard = "caller_is_identity_canister")]
#[trace]
async fn c2c_update_user_principal(args: Args) -> Response {
    let user_id = read_state(|state| get_user_id(&args, state));

    match user_canister_c2c_client::c2c_update_user_principal(
        user_id.into(),
        &user_canister::c2c_update_user_principal::Args {
            new_principal: args.new_principal,
        },
    )
    .await
    {
        Ok(user_canister::c2c_update_user_principal::Response::Success(result)) => {
            mutate_state(|state| {
                commit(
                    user_id,
                    args.old_principal,
                    args.new_principal,
                    result.canisters_to_notify,
                    state,
                )
            });
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn get_user_id(args: &Args, state: &RuntimeState) -> UserId {
    state.data.users.get_by_principal(&args.old_principal).unwrap().user_id
}

fn commit(
    user_id: UserId,
    old_principal: Principal,
    new_principal: Principal,
    mut canisters_to_notify: Vec<CanisterId>,
    state: &mut RuntimeState,
) {
    let now = state.env.now();
    let Some(mut user) = state.data.users.get(&old_principal).cloned() else {
        // Exit if the migration has already run
        return;
    };
    user.principal = new_principal;

    assert!(matches!(state.data.users.update(user, now), UpdateUserResult::Success));

    canisters_to_notify.push(state.data.notifications_index_canister_id);
    canisters_to_notify.push(state.data.storage_index_canister_id);

    let args = UpdateUserPrincipalArgs {
        user_id,
        old_principal,
        new_principal,
    };

    state
        .data
        .user_principal_updates_queue
        .push(args.clone(), canisters_to_notify);

    state.push_event_to_all_local_user_indexes(Event::UserPrincipalUpdated(args), None);

    crate::jobs::notify_user_principal_updates::start_job_if_required(state);
    crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
}
