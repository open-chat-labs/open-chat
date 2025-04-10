use crate::{mutate_state, RuntimeState, UserIndexEvent, UserToDelete};
use constants::SECOND_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{C2CError, CanisterId, Empty, Milliseconds};
use user_index_canister::UserDeleted;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState, delay: Option<Milliseconds>) -> bool {
    if TIMER_ID.get().is_none() && !state.data.users_to_delete_queue.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay.unwrap_or_default()), run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'delete_users' running");
    TIMER_ID.set(None);

    if let Some(user) = mutate_state(get_next) {
        ic_cdk::futures::spawn(process_user(user));
    }
}

fn get_next(state: &mut RuntimeState) -> Option<UserToDelete> {
    state.data.users_to_delete_queue.pop_front()
}

async fn process_user(user: UserToDelete) {
    let result = process_user_inner(&user).await;

    mutate_state(|state| {
        let user_id = user.user_id;
        let is_err = result.is_err();
        match result {
            Ok(DeleteUserSuccess::Deleted(_canisters_to_notify)) => {
                state.data.global_users.remove(&user_id);
                state.data.local_users.remove(&user_id);

                let now = state.env.now();
                if !user.triggered_by_user {
                    state.data.canister_pool.push(user_id.into());
                    state.push_event_to_user_index(UserIndexEvent::UserDeleted(Box::new(UserDeleted { user_id })), now);
                }

                // TODO uncomment this once Groups, Communities, UserIndex, GroupIndex and
                // LocalGroupIndex have been upgraded
                // for canister_id in canisters_to_notify {
                //     state.push_event_to_user_index(UserIndexEvent::NotifyOfUserDeleted(canister_id, user_id), now);
                // }
            }
            Ok(DeleteUserSuccess::Skipped) => {}
            Err(_) => {
                if user.attempt < 50 {
                    state.data.users_to_delete_queue.push_back(UserToDelete {
                        user_id,
                        triggered_by_user: user.triggered_by_user,
                        attempt: user.attempt + 1,
                    });
                }
            }
        }

        start_job_if_required(state, is_err.then_some(30 * SECOND_IN_MS));
    });
}

async fn process_user_inner(user: &UserToDelete) -> Result<DeleteUserSuccess, C2CError> {
    let user_id = user.user_id;
    let canister_id = user_id.into();

    if !user.triggered_by_user {
        let is_empty_and_dormant = user_canister_c2c_client::c2c_is_empty_and_dormant(canister_id, &Empty {}).await?;
        if !is_empty_and_dormant {
            return Ok(DeleteUserSuccess::Skipped);
        }
    }

    let (groups, communities) = user_canister_c2c_client::c2c_groups_and_communities(canister_id, &Empty {})
        .await
        .map(|r| (r.groups, r.communities))?;

    utils::canister::uninstall(canister_id).await?;

    Ok(DeleteUserSuccess::Deleted(
        groups
            .into_iter()
            .map(|g| g.into())
            .chain(communities.into_iter().map(|c| c.into()))
            .collect(),
    ))
}

enum DeleteUserSuccess {
    Deleted(Vec<CanisterId>),
    Skipped,
}
