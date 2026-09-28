use crate::model::users_to_migrate::UserToCloseOut;
use crate::{CanisterToRefund, RuntimeState, jobs, mutate_state, read_state};
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use ic_cdk_timers::TimerId;
use std::cell::{Cell, RefCell};
use std::time::Duration;
use tracing::{error, info, trace};
use types::{CanisterId, Milliseconds, TimestampMillis};
use user_canister::c2c_sweep_funds::LedgerToSweep;

const MAX_IN_PROGRESS: usize = 5;
const MAX_ATTEMPTS: u32 = 50;
// After this many attempts, any ledgers the canister still couldn't be swept of are given up on, so
// that a ledger which is down, or no longer exists, doesn't stop the canister being uninstalled
const MAX_SWEEP_ATTEMPTS: u32 = 20;
const RETRY_DELAY: Milliseconds = MINUTE_IN_MS;
// How long the list of token ledgers taken from the Registry is used for before being fetched again
const TOKEN_LEDGERS_TTL: Milliseconds = HOUR_IN_MS;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
    static TOKEN_LEDGERS: RefCell<Option<(TimestampMillis, Vec<LedgerToSweep>)>> = RefCell::default();
}

// Closes out the canisters of users who have been switched over to the MultiUser canister they were
// migrated to: each canister's balance of every token listed by the Registry is moved into the
// user's own account, where the users of a MultiUser canister hold their funds, and then the
// canister is uninstalled and its cycles refunded. Once it is uninstalled, whoever sends events to
// the user's old id finds they have been migrated, and sends them on to the user's new id.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none()
        && state.data.registry_canister_id.is_some()
        && let Some(next_due) = state.data.users_to_close_out.next_due(MAX_IN_PROGRESS)
    {
        let delay = next_due.saturating_sub(state.env.now());
        let timer_id = ic_cdk_timers::set_timer(Duration::from_millis(delay), async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'close_out_migrated_users' running");
    TIMER_ID.set(None);

    let batch = mutate_state(|state| {
        let now = state.env.now();
        let batch = state.data.users_to_close_out.take_next_batch(MAX_IN_PROGRESS, now);
        // Schedule the next run for any users not yet due
        start_job_if_required(state);
        batch
    });
    for user in batch {
        utils::async_work::spawn_tracked(process_user(user));
    }
}

async fn process_user(user: UserToCloseOut) {
    let result = close_out(&user).await;

    mutate_state(|state| {
        let user_id = user.user_id;
        let now = state.env.now();
        state.data.users_to_close_out.mark_complete(&user_id);

        match result {
            Ok(()) => {
                // The canister has been uninstalled but still holds its cycles
                if state.data.local_users.remove(&user_id) {
                    state.data.cycles_refund_queue.push_back(CanisterToRefund {
                        canister_id: user_id.canister_id(),
                        attempt: 0,
                        retry_after: 0,
                    });
                    jobs::refund_cycles::start_job_if_required(state, None);
                }
                info!(%user_id, "Migrated user's canister closed out");
            }
            Err(Some(ledgers)) if !ledgers.is_empty() && user.attempt + 1 >= MAX_SWEEP_ATTEMPTS => {
                error!(%user_id, ?ledgers, "Gave up sweeping migrated user's canister of these ledgers");
                state.data.users_to_close_out.push(UserToCloseOut {
                    ledgers_to_retry: Some(Vec::new()),
                    attempt: user.attempt + 1,
                    not_before: now + RETRY_DELAY,
                    ..user
                });
            }
            Err(ledgers_to_retry) if user.attempt + 1 < MAX_ATTEMPTS => {
                state.data.users_to_close_out.push(UserToCloseOut {
                    ledgers_to_retry,
                    attempt: user.attempt + 1,
                    not_before: now + RETRY_DELAY,
                    ..user
                });
            }
            Err(ledgers_to_retry) => {
                error!(%user_id, ?ledgers_to_retry, "Failed to close out migrated user's canister");
            }
        }

        start_job_if_required(state);
    });
}

// On failure, returns the ledgers the canister is still to be swept of, which is None if it is still
// to be swept of every ledger
async fn close_out(user: &UserToCloseOut) -> Result<(), Option<Vec<CanisterId>>> {
    let canister_id = user.user_id.canister_id();

    if user.ledgers_to_retry.as_ref().is_none_or(|ledgers| !ledgers.is_empty()) {
        let Ok(mut ledgers) = token_ledgers().await else {
            return Err(user.ledgers_to_retry.clone());
        };
        if let Some(ledgers_to_retry) = &user.ledgers_to_retry {
            ledgers.retain(|l| ledgers_to_retry.contains(&l.ledger_canister_id));
        }

        match user_canister_c2c_client::c2c_sweep_funds(canister_id, &user_canister::c2c_sweep_funds::Args { ledgers }).await {
            Ok(user_canister::c2c_sweep_funds::Response::Success(result)) => {
                if !result.failed.is_empty() {
                    return Err(Some(result.failed));
                }
            }
            Ok(user_canister::c2c_sweep_funds::Response::Error(error)) => {
                error!(%canister_id, ?error, "Failed to sweep migrated user's canister");
                return Err(user.ledgers_to_retry.clone());
            }
            Err(_) => return Err(user.ledgers_to_retry.clone()),
        }
    }

    // Once swept, only the uninstall is retried
    utils::canister::uninstall(canister_id).await.map_err(|_| Some(Vec::new()))
}

// The ledger of every token in the Registry, including disabled tokens, which users may still hold
async fn token_ledgers() -> Result<Vec<LedgerToSweep>, ()> {
    let (registry_canister_id, now) = read_state(|state| (state.data.registry_canister_id, state.env.now()));
    if let Some(ledgers) = TOKEN_LEDGERS.with_borrow(|cached| {
        cached
            .as_ref()
            .filter(|(fetched, _)| now < fetched + TOKEN_LEDGERS_TTL)
            .map(|(_, ledgers)| ledgers.clone())
    }) {
        return Ok(ledgers);
    }

    let Some(registry_canister_id) = registry_canister_id else {
        return Err(());
    };
    let response =
        registry_canister_c2c_client::updates(registry_canister_id, &registry_canister::updates::Args { since: None })
            .await
            .map_err(|error| error!(?error, "Failed to get token ledgers from the Registry"))?;

    let ledgers: Vec<_> = match response {
        registry_canister::updates::Response::Success(result) => result
            .token_details
            .unwrap_or_default()
            .into_iter()
            .map(|token| LedgerToSweep {
                ledger_canister_id: token.ledger_canister_id,
                fee: token.fee,
            })
            .collect(),
        registry_canister::updates::Response::SuccessNoUpdates => Vec::new(),
    };
    TOKEN_LEDGERS.set(Some((now, ledgers.clone())));
    Ok(ledgers)
}
