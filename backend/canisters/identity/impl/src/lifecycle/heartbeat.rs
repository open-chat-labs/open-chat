use crate::updates::migrate_legacy_principal::migrate_legacy_principal_impl;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use ic_cdk_macros::heartbeat;
use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use types::TimestampMillis;

thread_local! {
    static WAIT_UNTIL: Cell<Option<TimestampMillis>> = Cell::default();
    static IN_PROGRESS: RefCell<HashSet<Principal>> = RefCell::default();
}

#[heartbeat]
fn heartbeat() {
    migrate_legacy_principals::run();
}

mod migrate_legacy_principals {
    use super::*;

    pub fn run() {
        if let Some(next) = mutate_state(get_next) {
            ic_cdk::spawn(run_async(next));
        }
    }

    async fn run_async(principal: Principal) {
        let result = migrate_legacy_principal_impl(Some(principal)).await;

        if let Some(pause) = result.pause {
            let now = read_state(|state| state.env.now());
            WAIT_UNTIL.set(Some(now + pause));
        }

        IN_PROGRESS.with_borrow_mut(|i| i.remove(&principal));
    }

    fn get_next(state: &mut RuntimeState) -> Option<Principal> {
        if !state.data.principal_migration_job_enabled || state.data.legacy_principals.is_empty() {
            return None;
        }

        if let Some(ts) = WAIT_UNTIL.get() {
            let now = state.env.now();
            if now > ts {
                WAIT_UNTIL.set(None);
            } else {
                return None;
            }
        }

        IN_PROGRESS.with_borrow_mut(|i| state.data.legacy_principals.iter().copied().filter(|p| i.insert(*p)).next())
    }
}
