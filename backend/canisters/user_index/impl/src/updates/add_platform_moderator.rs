use crate::guards::caller_is_governance_principal;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use local_user_index_canister::{PlatformModeratorStatusChanged, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use user_index_canister::add_platform_moderator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn add_platform_moderator(args: Args) -> Response {
    mutate_state(|state| add_platform_moderator_impl(args, state))
}

fn add_platform_moderator_impl(args: Args, state: &mut RuntimeState) -> Response {
    let user_id = args.user_id;
    if state.data.platform_moderators.contains(&user_id) {
        return AlreadyPlatformModerator;
    }
    let Some(user) = state.data.users.get_by_user_id(&user_id) else {
        return Error(OCErrorCode::TargetUserNotFound.into());
    };
    // A suspended appointee joins the set but the live flag stays off until the suspension
    // lifts (sync_suspended_privileges restores it)
    let suspended = user.suspension_details.is_some();

    state.data.platform_moderators.insert(user_id);
    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::PlatformModeratorStatusChanged(PlatformModeratorStatusChanged {
            user_id,
            is_platform_moderator: !suspended,
        }),
        None,
    );
    Success
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use crate::model::user::User;
    use candid::Principal;
    use types::UserId;
    use utils::env::test::TestEnv;

    fn setup() -> (RuntimeState, UserId) {
        let user_id = UserId::new_indexed(Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 2, 1, 1]), 1);
        let mut data = Data::default();
        data.users.add_test_user(User {
            principal: Principal::from_slice(&[10; 29]),
            user_id,
            username: "user".to_string(),
            ..Default::default()
        });
        (RuntimeState::new(Box::new(TestEnv::default()), data), user_id)
    }

    #[test]
    fn a_user_is_added_once() {
        let (mut state, user_id) = setup();
        assert!(matches!(add_platform_moderator_impl(Args { user_id }, &mut state), Success));
        assert!(state.data.platform_moderators.contains(&user_id));
        assert!(matches!(
            add_platform_moderator_impl(Args { user_id }, &mut state),
            AlreadyPlatformModerator
        ));
    }

    #[test]
    fn an_unknown_user_is_rejected() {
        let (mut state, user_id) = setup();
        let unknown = UserId::new_indexed(user_id.canister_id(), 2);
        let response = add_platform_moderator_impl(Args { user_id: unknown }, &mut state);
        assert!(
            matches!(&response, Error(e) if e.matches_code(OCErrorCode::TargetUserNotFound)),
            "{response:?}"
        );
        assert!(state.data.platform_moderators.is_empty());
    }
}
