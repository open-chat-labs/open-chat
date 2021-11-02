use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use tracing::instrument;
use types::AlertId;
use user_canister::dismiss_alerts::{Response::*, *};

#[update]
#[instrument(level = "trace")]
fn dismiss_alert(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| dismiss_alert_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn dismiss_alert_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();

    let mut not_found = Vec::new();
    for ext_id in args.alert_ids.into_iter() {
        let alert_id = AlertId::try_parse(&ext_id.clone());

        match alert_id {
            Some(AlertId::Internal(id)) => {
                if runtime_state.data.alerts.remove(id).is_some() {
                    continue;
                }
            }
            Some(AlertId::GroupDeleted(chat_id)) => {
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
