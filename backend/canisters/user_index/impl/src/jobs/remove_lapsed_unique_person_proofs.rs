use crate::{RuntimeState, mutate_state};
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;
use types::{UniquePersonProofProvider, UserId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const BATCH_SIZE: usize = 500;

// Removes unique person proofs that are no longer valid, fanning each removal
// out to the local user indexes and user canisters. Covers two cases:
// - legacy DecideAI-provider proofs (the one-off cutover wipe)
// - OpenChat-provider proofs issued against an embedding model version that
//   has lapsed following a model upgrade
// The job is stateless and idempotent: each execution rescans for up to
// BATCH_SIZE affected users, so it survives upgrades mid-sweep.
pub(crate) fn start_job_if_required(state: &RuntimeState) {
    if TIMER_ID.get().is_some() {
        return;
    }
    let now = state.env.now();
    // Only arm the timer if there is actually work: a deliberate legacy wipe,
    // or a model-version lapse. Otherwise every upgrade would rescan for
    // nothing.
    let delay = match state.data.personhood_model_lapse {
        Some(lapse) if lapse.lapses_at > now => Some(Duration::from_millis(lapse.lapses_at - now)),
        Some(_) => Some(Duration::ZERO),
        None if state.data.wipe_legacy_unique_person_proofs => Some(Duration::ZERO),
        None => None,
    };
    if let Some(delay) = delay {
        let timer_id = ic_cdk_timers::set_timer(delay, run);
        TIMER_ID.set(Some(timer_id));
    }
}

// Re-arms the timer after a new lapse announcement (cancelling any pending)
pub(crate) fn restart_job(state: &RuntimeState) {
    if let Some(timer_id) = TIMER_ID.take() {
        ic_cdk_timers::clear_timer(timer_id);
    }
    start_job_if_required(state);
}

fn run() {
    TIMER_ID.set(None);
    let more = mutate_state(run_batch);
    if more {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
    }
}

fn run_batch(state: &mut RuntimeState) -> bool {
    let now = state.env.now();
    let wipe_legacy = state.data.wipe_legacy_unique_person_proofs;
    let lapse = state.data.personhood_model_lapse.filter(|lapse| lapse.lapses_at <= now);

    let to_remove: Vec<UserId> = state
        .data
        .users
        .iter()
        .filter(|user| {
            user.unique_person_proof.as_ref().is_some_and(|proof| match proof.provider {
                UniquePersonProofProvider::DecideAI => wipe_legacy,
                UniquePersonProofProvider::OpenChat => {
                    lapse.is_some_and(|lapse| proof.model_version.unwrap_or(0) < lapse.new_version)
                }
            })
        })
        .map(|user| user.user_id)
        .take(BATCH_SIZE)
        .collect();

    let count = to_remove.len();
    for user_id in to_remove {
        state.remove_unique_person_proof(user_id);
    }
    if count > 0 {
        info!(count, "Removed unique person proofs");
    }

    if count == BATCH_SIZE {
        true
    } else {
        // Sweep complete: retire both one-shot markers so future upgrades
        // don't rescan
        if lapse.is_some() {
            state.data.personhood_model_lapse = None;
        }
        state.data.wipe_legacy_unique_person_proofs = false;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::User;
    use crate::{Data, PersonhoodModelLapse, RuntimeState};
    use candid::Principal;
    use types::{UniquePersonProof, UniquePersonProofProvider};
    use utils::env::test::TestEnv;

    fn add_user(data: &mut Data, id: u8, proof: Option<UniquePersonProof>) -> UserId {
        let user_id: UserId = Principal::from_slice(&[id]).into();
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[id, id]),
            user_id,
            username: format!("user{id}"),
            unique_person_proof: proof,
            ..Default::default()
        });
        user_id
    }

    fn proof(provider: UniquePersonProofProvider, model_version: Option<u16>) -> Option<UniquePersonProof> {
        Some(UniquePersonProof {
            timestamp: 1,
            provider,
            model_version,
        })
    }

    #[test]
    fn wipes_decideai_proofs_and_lapses_superseded_versions() {
        let env = TestEnv::default();
        let mut data = Data::default();
        let legacy = add_user(&mut data, 1, proof(UniquePersonProofProvider::DecideAI, None));
        let lapsed = add_user(&mut data, 2, proof(UniquePersonProofProvider::OpenChat, Some(1)));
        let current = add_user(&mut data, 3, proof(UniquePersonProofProvider::OpenChat, Some(2)));
        let unverified = add_user(&mut data, 4, None);
        let now = env.now;
        let mut state = RuntimeState::new(Box::new(env), data);

        // Nothing triggered: DecideAI proofs are NOT wiped on their own
        let more = run_batch(&mut state);
        assert!(!more);
        assert!(get_proof(&state, &legacy).is_some());

        // Wipe deliberately requested: the DecideAI proof is removed and the
        // OpenChat proofs are untouched; the flag clears when the sweep ends
        state.data.wipe_legacy_unique_person_proofs = true;
        let more = run_batch(&mut state);
        assert!(!more);
        assert!(!state.data.wipe_legacy_unique_person_proofs);
        assert!(get_proof(&state, &legacy).is_none());
        assert!(get_proof(&state, &lapsed).is_some());
        assert!(get_proof(&state, &current).is_some());

        // Lapse deadline passed: version-1 proofs are removed, version-2 kept
        state.data.personhood_model_lapse = Some(PersonhoodModelLapse {
            new_version: 2,
            lapses_at: now,
        });
        let more = run_batch(&mut state);
        assert!(!more);
        assert!(get_proof(&state, &lapsed).is_none());
        assert!(get_proof(&state, &current).is_some());
        assert!(get_proof(&state, &unverified).is_none());
        // Sweep complete: the lapse marker is retired
        assert!(state.data.personhood_model_lapse.is_none());
    }

    fn get_proof(state: &RuntimeState, user_id: &UserId) -> Option<types::UniquePersonProof> {
        state.data.users.get_by_user_id(user_id).unwrap().unique_person_proof.clone()
    }
}
