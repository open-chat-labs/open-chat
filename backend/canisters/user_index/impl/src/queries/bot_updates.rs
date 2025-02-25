use crate::model::user_map::BotUpdate;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use std::cmp::max;
use std::collections::{HashMap, HashSet};
use user_index_canister::bot_updates::{Response::*, *};

#[query(msgpack = true)]
fn bot_updates(args: Args) -> Response {
    read_state(|state| bot_updates_impl(args, state))
}

fn bot_updates_impl(args: Args, state: &RuntimeState) -> Response {
    if args.updated_since == 0 {
        return Success(initial_state(state));
    }

    let mut added_or_updated = HashMap::new();
    let mut removed = HashSet::new();
    let mut timestamp = 0;

    for (ts, update) in state.data.users.iter_bot_updates(args.updated_since) {
        timestamp = max(timestamp, ts);
        match update {
            BotUpdate::Added(id) | BotUpdate::Updated(id) => {
                if let Some(bot) = state.data.users.get_bot(&id) {
                    added_or_updated.entry(id).or_insert_with(|| bot.to_schema(id));
                }
            }
            BotUpdate::Removed(id) => {
                removed.insert(id);
            }
        }
    }

    if timestamp > 0 {
        Success(SuccessResult {
            added_or_updated: added_or_updated.into_values().collect(),
            removed: removed.into_iter().collect(),
            timestamp,
        })
    } else {
        SuccessNoUpdates
    }
}

fn initial_state(state: &RuntimeState) -> SuccessResult {
    let mut bots = Vec::new();
    let mut timestamp = 0;

    for (id, bot) in state.data.users.iter_bots() {
        timestamp = max(timestamp, bot.last_updated);
        bots.push(bot.to_schema(*id));
    }

    SuccessResult {
        added_or_updated: bots,
        removed: Vec::new(),
        timestamp,
    }
}
