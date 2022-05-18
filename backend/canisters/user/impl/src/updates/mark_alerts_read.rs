use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use std::str::FromStr;
use types::{AlertDetails, AlertId, GroupDeleted};
use user_canister::mark_alerts_read::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn mark_alerts_read(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| mark_alerts_read_impl(args, state))
}

fn mark_alerts_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let mut not_found = Vec::new();
    for ext_id in args.alert_ids {
        match AlertId::from_str(&ext_id) {
            Ok(AlertId::Internal(id)) => {
                if runtime_state.data.alerts.mark_read(id) {
                    continue;
                }
            }
            Ok(AlertId::GroupDeleted(delete_group_info)) => {
                // Actually remove the group reference at this point
                if runtime_state.data.group_chats.remove(delete_group_info.id, now).is_some() {
                    // When a group is deleted there could be 1000s of users, so we don't push
                    // alerts to the user canisters at the time of deletion. Instead, when the user
                    // canister queries the group_index, the reply contains the details of any
                    // deleted groups, an alert is then generated for each group. But since this
                    // happens within the context of a query call we can't save those alerts. So
                    // the group deleted alerts only get saved to the user canister state when the
                    // frontend marks them as read.
                    let id = runtime_state.data.alerts.add(
                        AlertDetails::GroupDeleted(GroupDeleted {
                            chat_id: delete_group_info.id,
                            deleted_by: delete_group_info.deleted_by,
                            group_name: delete_group_info.group_name,
                        }),
                        delete_group_info.timestamp,
                    );
                    runtime_state.data.alerts.mark_read(id);
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
