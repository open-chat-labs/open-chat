use crate::model::user_map::BotUpdate;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use std::cmp::max;
use user_index_canister::bot_updates::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn bot_updates(args: Args) -> Response {
    read_state(|state| bot_updates_impl(args, state))
}

fn bot_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let mut result = SuccessResult {
        added_or_updated: Vec::new(),
        removed: Vec::new(),
        timestamp: 0,
    };

    for (ts, update) in state.data.users.iter_bot_updates(args.updated_since) {
        result.timestamp = max(result.timestamp, ts);
        match update {
            BotUpdate::Added(id) | BotUpdate::Updated(id) => {
                if let Some(bot) = state.data.users.get_bot(&id) {
                    result.added_or_updated.push(BotSchema {
                        id,
                        owner: bot.owner,
                        name: bot.name.clone(),
                        avatar_id: bot.avatar.as_ref().map(|a| a.id),
                        endpoint: bot.endpoint.clone(),
                        description: bot.description.clone(),
                        commands: bot.commands.clone(),
                        autonomous_config: bot.autonomous_config.clone(),
                        last_updated: bot.last_updated,
                    });
                }
            }
            BotUpdate::Removed(id) => {
                result.removed.push(id);
            }
        }
    }

    if result.timestamp > 0 {
        Success(result)
    } else {
        SuccessNoUpdates
    }
}
