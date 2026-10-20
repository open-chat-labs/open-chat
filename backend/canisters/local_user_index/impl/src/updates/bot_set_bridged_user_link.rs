use crate::bots::extract_access_context_from_chat_context;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use local_user_index_canister::bot_set_bridged_user_link::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::{BridgedUserLinkChange, BridgedUserLinked, LocalUserIndexEvent as UserIndexEvent};

#[update(candid = true, json = true, msgpack = true)]
fn bot_set_bridged_user_link(args: Args) -> Response {
    match mutate_state(|state| bot_set_bridged_user_link_impl(args, state)) {
        Ok(()) => Response::Success,
        Err(error) => Response::Error(error),
    }
}

fn bot_set_bridged_user_link_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let context = extract_access_context_from_chat_context(args.chat_context, state)?;

    let platform = args.bridged_user.platform();
    if state.data.bridge_bots.get(&platform) != Some(&context.bot_id) {
        return Err(OCErrorCode::InitiatorNotAuthorized
            .with_message(format!("Only the {platform} bridge bot can link {platform} accounts")));
    }
    args.bridged_user
        .validate()
        .map_err(|error| OCErrorCode::InvalidRequest.with_message(error))?;

    // A command's access token names the user who ran it, so only they can be linked. The bridge bot
    // vouches for the account itself, so can unlink it autonomously when its owner asks there.
    let change = match (context.initiator.user(), args.linked) {
        (Some(user_id), true) => BridgedUserLinkChange::Linked(user_id),
        (Some(user_id), false) => BridgedUserLinkChange::Unlinked(user_id),
        (None, false) => BridgedUserLinkChange::UnlinkedByAccount,
        (None, true) => {
            return Err(OCErrorCode::InvalidRequest.with_message("An account can only be linked by a user's command"));
        }
    };

    let now = state.env.now();
    state.push_event_to_user_index(
        UserIndexEvent::BridgedUserLinked(Box::new(BridgedUserLinked {
            user: args.bridged_user,
            change,
        })),
        now,
    );
    Ok(())
}
