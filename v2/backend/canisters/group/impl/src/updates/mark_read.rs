use crate::updates::mark_read::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::mark_read::*;
use ic_cdk_macros::update;
use utils::range_set::insert_ranges;

#[update]
fn mark_read(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| mark_read_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = &runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal_mut(caller) {
        let mut has_changes = false;
        let mut unrecognised_message_ids = Vec::new();
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
                    unrecognised_message_ids.push(message_id);
                }
            }
            has_changes = !added.is_empty();
        }
        if has_changes {
            participant.read_by_me_updated = runtime_state.env.now();
            Success(SuccessResult {
                unrecognised_message_ids,
            })
        } else {
            SuccessNoChange(SuccessResult {
                unrecognised_message_ids,
            })
        }
    } else {
        NotInGroup
    }
}
