use crate::updates::c2c_delete_community::{commit, remove_files};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_index_canister::c2c_notify_community_uninstalled::*;
use oc_error_codes::OCErrorCode;
use tracing::info;
use types::OCResult;

// Called by a LocalUserIndex on finding that one of its communities' canisters has been
// uninstalled (eg. by the IC once it ran out of cycles). The community's state went with its
// code, so it can't delete itself and is removed here instead. Its list of members is gone too,
// so they aren't notified. Each of them stops seeing the community once its LocalUserIndex no
// longer knows of it.
#[update(msgpack = true)]
#[trace]
fn c2c_notify_community_uninstalled(args: Args) -> Response {
    let community_id = args.community_id;
    mutate_state(|state| {
        c2c_notify_community_uninstalled_impl(args, state)?;
        remove_files(community_id, state);
        Ok(())
    })
    .into()
}

fn c2c_notify_community_uninstalled_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let community_id = args.community_id;

    let Some(local_user_index_canister_id) = state.data.local_index_map.get_index_canister_for_community(&community_id) else {
        return Err(OCErrorCode::CommunityNotFound.into());
    };

    // Only the LocalUserIndex which controls the community's canister can tell that it has been
    // uninstalled
    if state.env.caller() != local_user_index_canister_id {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    // Only a public community's name is known here
    let name = state
        .data
        .public_communities
        .get(&community_id)
        .map(|c| c.name().to_string())
        .unwrap_or_default();

    commit(community_id, OPENCHAT_BOT_USER_ID, name, Vec::new(), state);
    info!(%community_id, "Uninstalled community deleted");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::private_communities::PrivateCommunityInfo;
    use candid::Principal;
    use types::{CanisterId, CommunityId};
    use utils::env::test::TestEnv;

    #[test]
    fn community_is_deleted_when_notified_by_its_local_user_index() {
        let mut state = setup_runtime_state(local_user_index());

        let result = c2c_notify_community_uninstalled_impl(
            Args {
                community_id: community_id(),
            },
            &mut state,
        );

        assert!(result.is_ok());
        assert!(state.data.private_communities.get(&community_id()).is_none());
        assert!(state.data.deleted_communities.get(&community_id()).is_some());
        assert!(
            state
                .data
                .local_index_map
                .get_index_canister_for_community(&community_id())
                .is_none()
        );
    }

    #[test]
    fn any_other_caller_is_not_authorized() {
        let mut state = setup_runtime_state(Principal::from_slice(&[3]));

        let result = c2c_notify_community_uninstalled_impl(
            Args {
                community_id: community_id(),
            },
            &mut state,
        );

        assert!(matches!(result, Err(error) if error.matches_code(OCErrorCode::InitiatorNotAuthorized)));
        assert!(state.data.private_communities.get(&community_id()).is_some());
        assert!(state.data.deleted_communities.get(&community_id()).is_none());
    }

    #[test]
    fn unknown_community_is_not_found() {
        let mut state = setup_runtime_state(local_user_index());
        let community_id = Principal::from_slice(&[4]).into();

        let result = c2c_notify_community_uninstalled_impl(Args { community_id }, &mut state);

        assert!(matches!(result, Err(error) if error.matches_code(OCErrorCode::CommunityNotFound)));
    }

    fn setup_runtime_state(caller: Principal) -> RuntimeState {
        let env = TestEnv {
            caller,
            ..Default::default()
        };
        let mut data = Data::default();
        data.local_index_map.add_index(local_user_index());
        data.local_index_map.add_community(local_user_index(), community_id());
        data.private_communities
            .add(PrivateCommunityInfo::new(community_id(), env.now));

        RuntimeState::new(Box::new(env), data)
    }

    fn local_user_index() -> CanisterId {
        Principal::from_slice(&[1])
    }

    fn community_id() -> CommunityId {
        Principal::from_slice(&[2]).into()
    }
}
