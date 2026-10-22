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
use tracing::warn;
use types::{CanisterId, ChatId, CommunityId};

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

// Each is applied as it was when the group or community called the GroupIndex itself. The
// LocalUserIndex vouches for which of its chats sent it, so each chat is checked to be one of that
// LocalUserIndex's.
fn handle_event(event: LocalIndexEvent, caller: CanisterId, state: &mut RuntimeState) {
    match event {
        LocalIndexEvent::GroupActive(ev) => {
            if holds_group(caller, ev.chat_id, state) {
                mark_group_active(ev.chat_id, ev.duration, ev.public_group_activity, state);
            }
        }
        LocalIndexEvent::CommunityActive(ev) => {
            if holds_community(caller, ev.community_id, state) {
                mark_community_active(ev.community_id, ev.duration, ev.public_community_activity, state);
            }
        }
        LocalIndexEvent::GroupImportComplete(ev) => {
            if holds_community(caller, ev.community_id, state) {
                mark_group_import_complete(*ev, caller, state);
            }
        }
        LocalIndexEvent::CommunityUninstalled(community_id) => match community_uninstalled(community_id, caller, state) {
            Ok(()) => remove_files(community_id, state),
            Err(error) => warn!(%caller, %community_id, ?error, "Uninstalled community not deleted"),
        },
    }
}

fn holds_group(local_user_index: CanisterId, chat_id: ChatId, state: &RuntimeState) -> bool {
    let holder = state.data.local_index_map.get_index_canister_for_group(&chat_id);
    if holder != Some(local_user_index) {
        warn!(%local_user_index, %chat_id, ?holder, "Group event from a LocalUserIndex not holding the group");
        return false;
    }
    true
}

fn holds_community(local_user_index: CanisterId, community_id: CommunityId, state: &RuntimeState) -> bool {
    let holder = state.data.local_index_map.get_index_canister_for_community(&community_id);
    if holder != Some(local_user_index) {
        warn!(%local_user_index, %community_id, ?holder, "Community event from a LocalUserIndex not holding the community");
        return false;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::private_communities::PrivateCommunityInfo;
    use crate::model::private_groups::PrivateGroupInfo;
    use crate::{Data, MARK_ACTIVE_DURATION};
    use candid::Principal;
    use group_index_canister::{GroupActive, GroupImportComplete};
    use types::ChannelLatestMessageIndex;
    use utils::env::test::TestEnv;

    // Only the LocalUserIndex holding a group can mark it active
    #[test]
    fn a_group_marked_active_by_another_local_user_index_is_unchanged() {
        let env = TestEnv::default();
        let now = env.now;
        let local_user_index = CanisterId::from_slice(&[1]);
        let chat_id: ChatId = Principal::from_slice(&[2]).into();
        let mut data = Data::default();
        data.local_index_map.add_index(local_user_index);
        data.local_index_map.add_group(local_user_index, chat_id);
        data.private_groups.add(PrivateGroupInfo::new(chat_id, now));
        let mut state = RuntimeState::new(Box::new(env), data);

        handle_event(
            LocalIndexEvent::GroupActive(GroupActive {
                chat_id,
                duration: 10 * MARK_ACTIVE_DURATION,
                public_group_activity: None,
            }),
            CanisterId::from_slice(&[3]),
            &mut state,
        );

        let group = state.data.private_groups.get(&chat_id).unwrap();
        assert!(!group.has_been_active_since(now + 2 * MARK_ACTIVE_DURATION));
    }

    // Only the LocalUserIndex holding a community can complete a group's import into it
    #[test]
    fn a_group_import_completed_by_another_local_user_index_is_ignored() {
        let env = TestEnv::default();
        let now = env.now;
        let local_user_index = CanisterId::from_slice(&[1]);
        let community_id: CommunityId = Principal::from_slice(&[2]).into();
        let group_id: ChatId = Principal::from_slice(&[3]).into();
        let mut data = Data::default();
        data.local_index_map.add_index(local_user_index);
        data.local_index_map.add_community(local_user_index, community_id);
        data.local_index_map.add_group(local_user_index, group_id);
        data.private_communities.add(PrivateCommunityInfo::new(community_id, now));
        data.private_groups.add(PrivateGroupInfo::new(group_id, now));
        let mut state = RuntimeState::new(Box::new(env), data);

        handle_event(
            LocalIndexEvent::GroupImportComplete(Box::new(GroupImportComplete {
                community_id,
                community_name: "community".to_string(),
                channel: ChannelLatestMessageIndex {
                    channel_id: 1u32.into(),
                    latest_message_index: None,
                },
                group_id,
                group_name: "group".to_string(),
                members: Vec::new(),
                other_public_channels: Vec::new(),
                mark_active_duration: MARK_ACTIVE_DURATION,
                public_community_activity: None,
            })),
            CanisterId::from_slice(&[4]),
            &mut state,
        );

        assert!(state.data.private_groups.get(&group_id).is_some());
        assert!(state.data.deleted_groups.get(&group_id).is_none());
    }

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
