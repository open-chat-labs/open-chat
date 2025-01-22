use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::bot_updates::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn bot_updates(args: Args) -> Response {
    read_state(|state| bot_updates_impl(args, state))
}

fn bot_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let added_or_updated: Vec<_> = state
        .data
        .users
        .iter_bots()
        .filter(|(_, b)| b.last_updated > args.updated_since)
        .map(|(id, b)| BotSchema {
            id: *id,
            owner: b.owner,
            name: b.name.clone(),
            avatar_id: b.avatar.as_ref().map(|a| a.id),
            endpoint: b.endpoint.clone(),
            description: b.description.clone(),
            commands: b.commands.clone(),
            last_updated: b.last_updated,
        })
        .collect();

    let removed = state.data.users.iter_bots_removed_since(args.updated_since).collect();

    if let Some(timestamp) = added_or_updated.iter().map(|b| b.last_updated).max() {
        Success(SuccessResult {
            added_or_updated,
            removed,
            deleted: Vec::new(),
            timestamp,
        })
    } else {
        SuccessNoUpdates
    }
}
