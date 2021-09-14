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
        if let Some(max_message_index) = runtime_state.data.events.latest_message_index() {
            let min_message_index = participant.min_visible_message_index;
            has_changes = insert_ranges(
                &mut participant.read_by_me,
                &args.message_ranges,
                min_message_index,
                max_message_index,
            );
        }
        if has_changes {
            participant.read_by_me_updated = runtime_state.env.now();
            Success
        } else {
            SuccessNoChange
        }
    } else {
        NotInGroup
    }
}
