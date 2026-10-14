use crate::model::users::Users;
use crate::{RuntimeState, mutate_state, read_state, run_regular_jobs};
use ic_cdk_timers::TimerId;
use serde::{Deserialize, Serialize};
use std::cell::Cell;
use std::time::Duration;
use tracing::{error, info, trace};

const MAX_INSTRUCTIONS_PER_RUN: u64 = 2_000_000_000;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

// The progress of the job, which is also shown in the canister's metrics
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DirectChatsRewrite {
    // The index from which the next run starts
    pub next_user_index: u16,
    pub complete: bool,
    // The chats which were stored in an earlier format
    pub chats_rewritten: u32,
    // The chats left as they were, since they still hold data on the heap from before their events
    // data was stored in stable memory (see `DirectChats::rewrite_all`)
    pub chats_left: u32,
}

// Writes every user's direct chats back to stable memory, a batch of users at a time, so that each is
// stored in the current format rather than as when it last changed. Once it has completed in every
// MultiUser canister, with no chats left, and every Group and Community canister has been upgraded
// past the upgrade guard which refuses to drop chat events data held on the heap (see
// `ChatEvents::legacy_heap_entries`), with no import exported by a Group from before then still in
// progress, what reads the earlier formats can be removed (eg. the `LegacyHeapEntries` in
// `chat_events`, and reading a plain list of message event indexes), along with this.
pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.direct_chats_rewrite.complete {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, async { run() });
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'rewrite_direct_chats' job running");
    TIMER_ID.set(None);
    run_regular_jobs();

    mutate_state(|state| {
        let data = &mut state.data;
        rewrite_batch(&mut data.users, &mut data.direct_chats_rewrite, &mut || {
            ic_cdk::api::instruction_counter() > MAX_INSTRUCTIONS_PER_RUN
        });
        if data.direct_chats_rewrite.complete {
            info!(rewrite = ?data.direct_chats_rewrite, "Finished rewriting direct chats");
        }
    });
    read_state(start_job_if_required);
}

// Rewrites each user's direct chats in order of index, from `next_user_index`, until `should_stop`
// returns true after a user, or every user has been
fn rewrite_batch(users: &mut Users, rewrite: &mut DirectChatsRewrite, should_stop: &mut dyn FnMut() -> bool) {
    while let Some(index) = users.next_index(rewrite.next_user_index) {
        if let Some((rewritten, left)) = users.with_user_mut(index, |user| user.direct_chats.rewrite_all()) {
            rewrite.chats_rewritten += rewritten;
            if left > 0 {
                error!(user_index = index, left, "Direct chats left holding data on the heap");
                rewrite.chats_left += left;
            }
        }
        // An index is at most `MAX_USER_INDEX`, so this can't overflow
        rewrite.next_user_index = index + 1;
        if should_stop() {
            return;
        }
    }
    rewrite.complete = true;
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::{UserId, UserType};

    #[test]
    fn users_are_rewritten_a_batch_at_a_time_until_every_one_has_been() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_multi_user(memory.get(MemoryId::new(0)), memory.get(MemoryId::new(1)));
        let user_id = |i: u8| UserId::from(Principal::from_slice(&[i]));
        let mut users = Users::default();
        // Users 1, 3 and 4
        for i in 1..=4u8 {
            users.add(Principal::from_slice(&[i]), format!("user{i}"), None, 0).unwrap();
        }
        users.remove(2);
        for index in [1, 3] {
            users.with_user_mut(index, |user| {
                user.direct_chats
                    .get_or_create(user_id(index as u8), user_id(10), UserType::User, || 1, 0);
            });
        }
        let mut rewrite = DirectChatsRewrite::default();

        // Each run stops once it has rewritten two users' chats
        let mut runs = 0;
        while !rewrite.complete {
            let mut users_rewritten = 0;
            rewrite_batch(&mut users, &mut rewrite, &mut || {
                users_rewritten += 1;
                users_rewritten == 2
            });
            runs += 1;
            assert!(runs <= 2);
        }

        assert_eq!(rewrite.next_user_index, 5);
        // The chats were created in the current format, so needn't be written again (see
        // `DirectChats::rewrite_all` for chats which do)
        assert_eq!(rewrite.chats_rewritten, 0);
        assert_eq!(rewrite.chats_left, 0);
    }
}
