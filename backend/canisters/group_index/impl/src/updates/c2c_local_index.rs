use crate::guards::caller_is_local_user_index;
use crate::updates::c2c_delete_community::remove_files;
use crate::updates::c2c_mark_active::mark_group_active;
use crate::updates::c2c_mark_community_active::mark_community_active;
use crate::updates::c2c_mark_group_import_complete::mark_group_import_complete;
use crate::updates::c2c_notify_community_uninstalled::community_uninstalled;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::LocalIndexEvent;
use group_index_canister::c2c_local_index::*;
use types::CanisterId;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_index_impl(args, state))
}

fn c2c_local_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, caller, state);
        }
    }
    Response::Success
}

// Each is applied as the endpoint it replaces applied it when the group or community called it
// itself. The LocalUserIndex vouches for which of its chats sent it, so each chat is checked to be
// one of that LocalUserIndex's.
fn handle_event(event: LocalIndexEvent, caller: CanisterId, state: &mut RuntimeState) {
    match event {
        LocalIndexEvent::GroupActive(ev) => {
            if state.data.local_index_map.get_index_canister_for_group(&ev.chat_id) == Some(caller) {
                mark_group_active(ev.chat_id, ev.duration, ev.public_group_activity, state);
            }
        }
        LocalIndexEvent::CommunityActive(ev) => {
            if state.data.local_index_map.get_index_canister_for_community(&ev.community_id) == Some(caller) {
                mark_community_active(ev.community_id, ev.duration, ev.public_community_activity, state);
            }
        }
        LocalIndexEvent::GroupImportComplete(ev) => {
            if state.data.local_index_map.get_index_canister_for_community(&ev.community_id) == Some(caller) {
                mark_group_import_complete(*ev, state);
            }
        }
        LocalIndexEvent::CommunityUninstalled(community_id) => {
            if community_uninstalled(community_id, caller, state).is_ok() {
                remove_files(community_id, state);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::private_communities::PrivateCommunityInfo;
    use candid::Principal;
    use types::CommunityId;
    use utils::env::test::TestEnv;

    // Only the LocalUserIndex holding a community can report it uninstalled
    #[test]
    fn an_uninstalled_community_reported_by_another_local_user_index_is_kept() {
        let env = TestEnv::default();
        let local_user_index = CanisterId::from_slice(&[1]);
        let community_id: CommunityId = Principal::from_slice(&[2]).into();
        let mut data = Data::default();
        data.local_index_map.add_index(local_user_index);
        data.local_index_map.add_community(local_user_index, community_id);
        data.private_communities.add(PrivateCommunityInfo::new(community_id, env.now));
        let mut state = RuntimeState::new(Box::new(env), data);

        handle_event(
            LocalIndexEvent::CommunityUninstalled(community_id),
            CanisterId::from_slice(&[3]),
            &mut state,
        );

        assert!(state.data.private_communities.get(&community_id).is_some());
        assert!(state.data.deleted_communities.get(&community_id).is_none());
    }
}
