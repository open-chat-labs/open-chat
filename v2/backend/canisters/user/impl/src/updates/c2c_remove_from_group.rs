use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{AlertDetails, RemovedFromGroup};
use user_canister::c2c_remove_from_group::{Response::*, *};

#[update]
#[trace]
fn c2c_remove_from_group(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| c2c_remove_from_group_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_remove_from_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();
    if runtime_state.data.group_chats.remove(chat_id, now).is_some() {
        let removed_from_group = RemovedFromGroup {
            chat_id,
            removed_by: args.removed_by,
        };
        let alert_details = if args.blocked {
            AlertDetails::BlockedFromGroup(removed_from_group)
        } else {
            AlertDetails::RemovedFromGroup(removed_from_group)
        };
        runtime_state.data.alerts.add(alert_details, now);
    }
    Success
}
