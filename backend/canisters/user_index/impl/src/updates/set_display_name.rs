use crate::guards::caller_is_openchat_user;
use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{DisplayNameChanged, Event};
use user_index_canister::set_display_name::{Response::*, *};
use utils::text_validation::{validate_display_name, UsernameValidationError};

#[update(guard = "caller_is_openchat_user")]
#[trace]
fn set_display_name(args: Args) -> Response {
    mutate_state(|state| set_display_name_impl(args, state))
}

fn set_display_name_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user) = state.data.users.get_by_principal(&caller) {
        if let Some(display_name) = args.display_name.as_ref() {
            match validate_display_name(display_name) {
                Ok(_) => {}
                Err(UsernameValidationError::TooShort(s)) => return DisplayNameTooShort(s.min_length as u16),
                Err(UsernameValidationError::TooLong(l)) => return DisplayNameTooLong(l.max_length as u16),
                Err(UsernameValidationError::Invalid) => return DisplayNameInvalid,
            };
        }

        let now = state.env.now();
        if !user.diamond_membership_details.is_active(now) && user.display_name.is_none() {
            return Unauthorized;
        }

        let mut user_to_update = user.clone();
        user_to_update.display_name = args.display_name.clone();
        let user_id = user.user_id;
        match state.data.users.update(user_to_update, now) {
            UpdateUserResult::Success => {
                state.push_event_to_local_user_index(
                    user_id,
                    Event::DisplayNameChanged(DisplayNameChanged {
                        user_id,
                        display_name: args.display_name,
                    }),
                );

                Success
            }
            result => panic!("Unexpected result returned when updating display name: {result:?}"),
        }
    } else {
        UserNotFound
    }
}
