use crate::updates::mark_read::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::mark_read::*;
use ic_cdk_macros::update;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use utils::range_set::insert_ranges;

#[update]
fn mark_read(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal_mut(caller) {
        let now = runtime_state.env.now();
        let mut has_changes = false;
        if let Some(max_message_index) = runtime_state.data.events.latest_message_index() {
            let min_message_index = participant.min_visible_message_index;
            let mut added = insert_ranges(
                &mut participant.read_by_me,
                &args.message_index_ranges,
                min_message_index,
                max_message_index,
            );
            for message_id in args.message_ids.into_iter() {
                if let Some(message_index) = runtime_state.data.events.get_message_index(message_id) {
                    if message_index < min_message_index {
                        continue;
                    }
                    let as_u32 = message_index.into();
                    if participant.read_by_me.insert(as_u32) {
                        added.insert(as_u32);
                    }
                } else {
                    match runtime_state.data.message_ids_read_but_not_confirmed.entry(message_id) {
                        Occupied(e) => e.into_mut().0.push(participant.user_id),
                        Vacant(e) => {
                            e.insert((vec![participant.user_id], now));
                        }
                    };
                }
            }
            has_changes = !added.is_empty();
        }
        if has_changes {
            participant.read_by_me_updated = now;
            Success
        } else {
            SuccessNoChange
        }
    } else {
        NotInGroup
    }
}
