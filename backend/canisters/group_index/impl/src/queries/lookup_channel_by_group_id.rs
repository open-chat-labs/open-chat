use crate::{read_state, RuntimeState};
use group_index_canister::lookup_channel_by_group_id::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn lookup_channel_by_group_id(args: Args) -> Response {
    read_state(|state| lookup_channel_by_group_id_impl(args, state))
}

fn lookup_channel_by_group_id_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(group) = state.data.deleted_groups.get(&args.group_id) {
        if let Some(community) = &group.community_imported_into {
            return Success(SuccessResult {
                community_id: community.community_id,
                channel_id: community.channel.channel_id,
            });
        }
    }

    NotFound
}
