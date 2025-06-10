use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use group_canister::selected_updates_v2::{Response::*, *};
use installed_bots::BotUpdate;
use std::collections::HashSet;
use types::{InstalledBotDetails, OCResult};

#[query(candid = true, msgpack = true)]
fn selected_updates_v2(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state)).unwrap_or_else(Error)
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> OCResult<Response> {
    let last_updated = state.data.details_last_updated();
    if last_updated <= args.updates_since {
        return Ok(SuccessNoUpdates(last_updated));
    }

    let user_id = state.get_caller_user_id()?;
    let bots = &state.data.bots;

    let mut bots_changed = HashSet::new();
    let mut results = state
        .data
        .chat
        .selected_group_updates(args.updates_since, last_updated, Some(user_id))?;

    for (user_id, update) in bots.iter_latest_updates(args.updates_since) {
        match update {
            BotUpdate::Added | BotUpdate::Updated => {
                if bots_changed.insert(user_id) {
                    if let Some(bot) = bots.get(&user_id) {
                        results.bots_added_or_updated.push(InstalledBotDetails {
                            user_id,
                            added_by: bot.added_by,
                            permissions: bot.permissions.clone(),
                            autonomous_permissions: bot.autonomous_permissions.clone(),
                        });
                    }
                }
            }
            BotUpdate::Removed => {
                if bots_changed.insert(user_id) {
                    results.bots_removed.push(user_id);
                }
            }
        }
    }

    Ok(if results.has_updates() { Success(results) } else { SuccessNoUpdates(last_updated) })
}
