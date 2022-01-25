use crate::model::user::User;
use crate::model::user_map::UpdateUserResult;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::Timestamped;
use user_index_canister::set_profile::{Response::*, *};

const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 3;
const MAX_BIO_LENGTH: u16 = 5000;

#[update]
#[trace]
fn set_profile(args: Args) -> Response {
    mutate_state(|state| set_profile_impl(args, state))
}

fn set_profile_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    if let Some(username) = &args.username {
        match validate_username(username) {
            UsernameValidationResult::TooShort(min_length) => return UsernameTooShort(min_length),
            UsernameValidationResult::TooLong(max_length) => return UsernameTooLong(max_length),
            UsernameValidationResult::Invalid => return UsernameInvalid,
            _ => {}
        };
    }

    if let Some(bio) = &args.bio {
        if let BioValidationResult::TooLong(max_length) = validate_bio(bio) {
            return BioTooLong(max_length);
        }
    }

    if args.username.is_none() && args.bio.is_none() {
        return Success;
    }

    if let Some(User::Created(user)) = runtime_state.data.users.get_by_principal(&caller) {
        let mut user_to_update = user.clone();
        user_to_update.date_updated = now;

        if let Some(username) = args.username {
            user_to_update.username = Timestamped::new(username, now);
        }

        if let Some(bio) = args.bio {
            user_to_update.bio = Timestamped::new(bio, now);
        }

        match runtime_state.data.users.update(User::Created(user_to_update)) {
            UpdateUserResult::Success => Success,
            UpdateUserResult::UsernameTaken => UsernameTaken,
            result => panic!("Unexpected result returned when updating profile: {result:?}"),
        }
    } else {
        UserNotCreated
    }
}

pub enum UsernameValidationResult {
    Ok,
    TooLong(u16),
    TooShort(u16),
    Invalid,
}

pub fn validate_username(username: &str) -> UsernameValidationResult {
    if username.len() > MAX_USERNAME_LENGTH as usize {
        return UsernameValidationResult::TooLong(MAX_USERNAME_LENGTH);
    }

    if username.len() < MIN_USERNAME_LENGTH as usize {
        return UsernameValidationResult::TooShort(MIN_USERNAME_LENGTH);
    }

    if username.starts_with('_') || username.ends_with('_') || username.contains("__") {
        return UsernameValidationResult::Invalid;
    }

    if username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        UsernameValidationResult::Ok
    } else {
        UsernameValidationResult::Invalid
    }
}

pub enum BioValidationResult {
    Ok,
    TooLong(u16),
}

pub fn validate_bio(bio: &str) -> BioValidationResult {
    if bio.len() > MAX_BIO_LENGTH as usize {
        return BioValidationResult::TooLong(MAX_USERNAME_LENGTH);
    }

    BioValidationResult::Ok
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_usernames() {
        assert!(matches!(validate_username("abc"), UsernameValidationResult::Ok));
        assert!(matches!(validate_username("123"), UsernameValidationResult::Ok));
        assert!(matches!(
            validate_username("1_2_3_4_5_6_7_8_9_0_1_2_3"),
            UsernameValidationResult::Ok
        ));
    }

    #[test]
    fn invalid_usernames() {
        assert!(matches!(validate_username("abc "), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab c"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("_abc"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abc_"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab__c"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("ab,c"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcé"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abcṷ"), UsernameValidationResult::Invalid));
        assert!(matches!(validate_username("abc王"), UsernameValidationResult::Invalid));
    }
}
