use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::lookup_members::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn lookup_members(args: Args) -> Response {
    read_state(|state| lookup_members_impl(args, state))
}

fn lookup_members_impl(args: Args, state: &RuntimeState) -> Response {
    if !state.data.is_public.value {
        let caller = state.env.caller();
        if !state.data.is_accessible(caller, None) {
            return PrivateCommunity;
        }
    }

    let members = args
        .user_ids
        .into_iter()
        .filter_map(|user_id| state.data.members.get_by_user_id(&user_id))
        .map(|member| member.clone().into())
        .collect();

    Success(SuccessResult { members })
}
