use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use std::str::FromStr;
use tracing::instrument;
use types::AlertId;
use user_canister::dismiss_alerts::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn dismiss_alerts(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| dismiss_alerts_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn dismiss_alerts_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();

    let mut not_found = Vec::new();
    for ext_id in args.alert_ids.into_iter() {
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
