use crate::guards::caller_is_identity_canister;
use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::Event;
use types::{CanisterId, Cycles, UpdateUserPrincipalArgs, UserId};
use user_index_canister::c2c_update_user_principal::{Response::*, *};
use utils::canister::deposit_cycles;
use utils::time::{MINUTE_IN_MS, SECOND_IN_MS};

const B: Cycles = 1_000_000_000;

#[update_msgpack(guard = "caller_is_identity_canister")]
#[trace]
async fn c2c_update_user_principal(args: Args) -> Response {
    let user_ids = read_state(|state| get_user_ids(&args, state));

    let futures = user_ids.into_iter().map(|u| update_user_principal_with_retry(u, &args));

    let responses = futures::future::join_all(futures).await;

    let mut response = Success;
    for r in responses {
        if matches!(response, InternalError(_)) {
            response = r;
            break;
        }
        response = r;
    }
    response
}

async fn update_user_principal_with_retry(user_id: UserId, args: &Args) -> Response {
    let response = update_user_principal(user_id, args).await;

    if let InternalError(error) = &response {
        if error.contains("out of cycles") {
            deposit_cycles(user_id.into(), 100 * B).await.unwrap();
            return update_user_principal(user_id, args).await;
        }
    }

    response
}

async fn update_user_principal(user_id: UserId, args: &Args) -> Response {
    match user_canister_c2c_client::c2c_update_user_principal(
        user_id.into(),
        &user_canister::c2c_update_user_principal::Args {
            new_principal: args.new_principal,
        },
    )
    .await
    {
        Ok(user_canister::c2c_update_user_principal::Response::Success(result)) => mutate_state(|state| {
            commit(
                user_id,
                args.old_principal,
                args.new_principal,
                result.canisters_to_notify,
                state,
            )
        }),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

// Due to a previous bug there are a few users with duplicate principals, so we should migrate them all
fn get_user_ids(args: &Args, state: &RuntimeState) -> Vec<UserId> {
    state
        .data
        .users
        .iter()
        .filter(|u| u.principal == args.old_principal)
        .map(|u| u.user_id)
        .collect()
}

fn commit(
    user_id: UserId,
    old_principal: Principal,
    new_principal: Principal,
    mut canisters_to_notify: Vec<CanisterId>,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();
    let Some(mut user) = state.data.users.get(&old_principal).cloned() else {
        // Exit if the migration has already run
        return Success;
    };
    user.principal = new_principal;
    user.principal_migrated = true;

    assert!(matches!(state.data.users.update(user, now, true), UpdateUserResult::Success));

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

    if state.data.user_principal_updates_queue.len() > 1000 {
        SuccessPause(MINUTE_IN_MS)
    } else if state.data.user_principal_updates_queue.len() > 500 {
        SuccessPause(15 * SECOND_IN_MS)
    } else {
        Success
    }
}
