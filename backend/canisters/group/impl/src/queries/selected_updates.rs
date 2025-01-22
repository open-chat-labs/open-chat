use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use group_canister::selected_updates_v2::{Response::*, *};
use group_community_common::BotUpdate;
use std::collections::HashSet;
use types::BotGroupDetails;

#[query(candid = true, msgpack = true)]
fn selected_updates_v2(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let bots = &state.data.bots;
    let last_updated = state.data.details_last_updated();
    if last_updated <= args.updates_since {
        return SuccessNoUpdates(last_updated);
    }

    let caller = state.env.caller();
    let user_id = match state.data.lookup_user_id(caller) {
        Some(id) => id,
        None => return CallerNotInGroup,
    };

    let mut results = state
        .data
        .chat
        .selected_group_updates(args.updates_since, last_updated, Some(user_id))
        .unwrap();

    let mut bots_changed = HashSet::new();
    for (user_id, update) in bots.iter_latest_updates(args.updates_since) {
        match update {
            BotUpdate::Added | BotUpdate::Updated => {
                if bots_changed.insert(user_id) {
                    if let Some(bot) = bots.get(&user_id) {
                        results.bots_added_or_updated.push(BotGroupDetails {
                            user_id,
                            permissions: bot.permissions.clone(),
                            added_by: bot.added_by,
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

    if results.has_updates() {
        Success(results)
    } else {
        SuccessNoUpdates(last_updated)
    }
}
