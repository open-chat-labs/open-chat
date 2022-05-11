use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{AlertDetails, RemovedFromGroup};
use user_canister::c2c_remove_from_group::{Response::*, *};

#[update]
#[trace]
fn c2c_remove_from_group(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_remove_from_group_impl(args, state))
}

fn c2c_remove_from_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let chat_id = runtime_state.env.caller().into();
    let now = runtime_state.env.now();
    if runtime_state.data.group_chats.remove(chat_id, now).is_some() {
        runtime_state.data.recommended_group_exclusions.add(chat_id, None, now);

        if let Some(cached_groups) = &mut runtime_state.data.cached_group_summaries {
            cached_groups.remove_group(&chat_id);
        }

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
