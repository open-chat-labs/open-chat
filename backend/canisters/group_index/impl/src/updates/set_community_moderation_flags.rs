use crate::{RuntimeState, model::moderation_flags::ModerationFlags, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::set_community_moderation_flags::{Response::*, *};
use types::CanisterId;
use user_index_canister_c2c_client::lookup_user;

#[update(msgpack = true)]
#[trace]
async fn set_community_moderation_flags(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_index_canister_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(result) => result,
        Err(response) => return response,
    };

    match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_moderator => (),
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    mutate_state(|state| commit(&args, state))
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(community) = state.data.public_communities.get(&args.community_id) {
        if args.flags == community.moderation_flags().bits() {
            return Err(Unchanged);
        }

        if ModerationFlags::from_bits(args.flags).is_none() {
            return Err(InvalidFlags);
        }

        Ok(PrepareResult {
            caller: state.env.caller(),
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else {
        Err(CommunityNotFound)
    }
}

fn commit(args: &Args, state: &mut RuntimeState) -> Response {
    if let Some(community) = state.data.public_communities.get_mut(&args.community_id) {
        community.set_moderation_flags(ModerationFlags::from_bits(args.flags).unwrap());
        Success
    } else {
        CommunityNotFound
    }
}
