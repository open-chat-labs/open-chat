use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use std::str::FromStr;
use types::AlertId;
use user_canister::dismiss_alerts::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn dismiss_alerts(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| dismiss_alerts_impl(args, state))
}

fn dismiss_alerts_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let mut not_found = Vec::new();
    for ext_id in args.alert_ids {
        match AlertId::from_str(&ext_id) {
            Ok(AlertId::Internal(id)) => {
                if runtime_state.data.alerts.remove(id).is_some() {
                    continue;
                }
            }
            Ok(AlertId::GroupDeleted(chat_id)) => {
                // Actually remove the group reference at this point
                if runtime_state.data.group_chats.remove(chat_id, now).is_some() {
                    continue;
                }
            }
            _ => (),
        }

        not_found.push(ext_id);
    }

    if not_found.is_empty() {
        Success
    } else {
        PartialSuccess(not_found)
    }
}
