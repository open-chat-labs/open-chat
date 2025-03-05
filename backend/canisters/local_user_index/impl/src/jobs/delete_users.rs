use crate::{mutate_state, read_state, RuntimeState, UserIndexEvent, UserToDelete};
use constants::SECOND_IN_MS;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{Empty, Milliseconds};
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
    let user_id = user.user_id;
    let canister_id = user_id.into();

    let mut error = false;
    if !user.triggered_by_user {
        match user_canister_c2c_client::c2c_is_empty_and_dormant(canister_id, &Empty {}).await {
            Ok(true) => {}
            Ok(false) => {
                read_state(|state| start_job_if_required(state, None));
                return;
            }
            Err(_) => error = true,
        };
    }

    if !error {
        error = utils::canister::uninstall(canister_id).await.is_err()
    }

    mutate_state(|state| {
        if !error {
            state.data.global_users.remove(&user_id);
            state.data.local_users.remove(&user_id);

            if !user.triggered_by_user {
                let now = state.env.now();
                state.push_event_to_user_index(UserIndexEvent::UserDeleted(Box::new(UserDeleted { user_id })), now);
                state.data.canister_pool.push(canister_id);
            }
        } else if user.attempt < 50 {
            state.data.users_to_delete_queue.push_back(UserToDelete {
                user_id,
                triggered_by_user: user.triggered_by_user,
                attempt: user.attempt + 1,
            });
        }

        start_job_if_required(state, error.then_some(30 * SECOND_IN_MS));
    })
}
