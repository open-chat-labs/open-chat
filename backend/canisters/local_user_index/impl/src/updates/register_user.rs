use crate::model::referral_codes::{ReferralCode, ReferralCodeError};
use crate::updates::c2c_create_multi_user_canister::create_multi_user_canister;
use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{RuntimeState, UserEvent, UserIndexEvent, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::USER_LIMIT;
use email_address::EmailAddress;
use local_user_index_canister::register_user::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use types::{CanisterId, MAX_USER_INDEX, MessageContentInitial, TextContent, UserId, UserType};
use user_canister::ReferredUserRegistered;
use user_index_canister::UserRegistered;
use utils::text_validation::{UsernameValidationError, validate_username};
use x509_parser::prelude::{FromDer, SubjectPublicKeyInfo};

#[update(msgpack = true)]
#[trace]
async fn register_user(args: Args) -> Response {
    // Check the principal is derived from Internet Identity + check the username is valid
    let PrepareOk {
        caller,
        referred_by,
        is_from_identity_canister,
        canister_id,
        openchat_bot_messages,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let result = create_user_in_multi_user_canister(
        canister_id,
        multi_user_canister::c2c_create_user::Args {
            principal: caller,
            username: args.username.clone(),
            referred_by,
            openchat_bot_messages,
        },
    )
    .await;

    match result {
        Ok(user_id) => {
            mutate_state(|state| {
                commit(
                    caller,
                    user_id,
                    args.username,
                    args.email,
                    referred_by,
                    is_from_identity_canister,
                    state,
                )
            });
            Success(SuccessResult {
                user_id,
                icp_account: types::UserIdAndPrincipal::new(user_id, caller).into(),
            })
        }
        Err(error) => {
            mutate_state(|state| state.data.local_users.mark_registration_failed(&caller));
            Error(error)
        }
    }
}

async fn create_user_in_multi_user_canister(
    mut existing: Option<CanisterId>,
    args: multi_user_canister::c2c_create_user::Args,
) -> Result<UserId, OCError> {
    while let Some(canister_id) = existing {
        match c2c_create_user(canister_id, &args).await {
            // The canister is full, so stop offering it and try whichever has the fewest users
            // now, only creating a new one once there are none left. Each canister is only tried
            // once, since each one found to be full is excluded from then on
            Err(error) if error.matches_code(OCErrorCode::UserLimitReached) => {
                existing = mutate_state(|state| {
                    state.data.local_multi_user_canisters.mark_full(&canister_id);
                    state.data.local_multi_user_canisters.canister_for_new_user()
                });
            }
            result => return result,
        }
    }

    let (canister_id, _) = create_multi_user_canister().await?;
    c2c_create_user(canister_id, &args).await
}

async fn c2c_create_user(
    canister_id: CanisterId,
    args: &multi_user_canister::c2c_create_user::Args,
) -> Result<UserId, OCError> {
    match top_up_and_retry_if_out_of_cycles(canister_id, || {
        multi_user_canister_c2c_client::c2c_create_user(canister_id, args)
    })
    .await?
    {
        multi_user_canister::c2c_create_user::Response::Success(user_id) => Ok(user_id),
        multi_user_canister::c2c_create_user::Response::Error(error) => Err(error),
    }
}

struct PrepareOk {
    caller: Principal,
    referred_by: Option<UserId>,
    is_from_identity_canister: bool,
    // The canister to add the user to, being the one with the fewest users. If it is full, whichever
    // has the fewest users next is tried, and a new one is only created once none remain
    canister_id: Option<CanisterId>,
    openchat_bot_messages: Vec<MessageContentInitial>,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = state.env.caller();

    if state.data.global_users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if let Some(canister_id) = args.multi_user_canister_id {
        if !state.data.test_mode {
            return Err(Error(
                OCErrorCode::InvalidRequest.with_message("A MultiUser canister can only be requested in test mode"),
            ));
        }
        if !state.data.local_multi_user_canisters.contains(&canister_id) {
            return Err(Error(
                OCErrorCode::InvalidRequest.with_message("MultiUser canister not found on this LocalUserIndex"),
            ));
        }
    }

    let now = state.env.now();
    if !state.data.local_users.mark_registration_in_progress(caller, now) {
        return Err(RegistrationInProgress);
    }

    let is_from_identity_canister =
        validate_public_key(caller, &args.public_key, state.data.identity_canister_id).map_err(PublicKeyInvalid)?;

    if state.data.global_users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    let mut referral_code = None;
    if let Some(code) = &args.referral_code {
        referral_code = match state.data.referral_codes.check(code, now) {
            Ok(r) => Some(r),
            Err(e) => {
                return Err(match e {
                    ReferralCodeError::NotFound => ReferralCodeInvalid,
                    ReferralCodeError::AlreadyClaimed => ReferralCodeAlreadyClaimed,
                    ReferralCodeError::Expired => ReferralCodeExpired,
                });
            }
        }
    }

    match validate_username(&args.username, &state.data.blocked_username_patterns) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(s)) => return Err(UsernameTooShort(s.min_length as u16)),
        Err(UsernameValidationError::TooLong(l)) => return Err(UsernameTooLong(l.max_length as u16)),
        Err(UsernameValidationError::Invalid) => return Err(UsernameInvalid),
    };

    if let Some(email) = &args.email
        && !EmailAddress::is_valid(email)
    {
        return Err(EmailInvalid);
    }

    let is_btc_miami = referral_code
        .as_ref()
        .filter(|c| matches!(c, ReferralCode::BtcMiami(_)))
        .is_some();

    // A referral link may name a user who has since been migrated to a MultiUser canister by their old
    // id, which they're no longer known by
    let referred_by = referral_code
        .and_then(|c| c.user())
        .map(|user_id| state.data.migrated_user_ids.latest(user_id))
        .filter(|user_id| state.data.global_users.contains(user_id));

    // The OpenChat bot's welcome messages, which the user's canister sends them once created
    let openchat_bot_messages = if is_btc_miami {
        vec![
            MessageContentInitial::Text(TextContent {
                text: "Welcome to OpenChat!!".to_string(),
            }),
            MessageContentInitial::Text(TextContent {
                text: format!("Wait a moment {}, your SATS are coming below 👇", args.username),
            }),
        ]
    } else {
        welcome_messages()
            .into_iter()
            .map(|t| MessageContentInitial::Text(TextContent { text: t }))
            .collect()
    };

    Ok(PrepareOk {
        caller,
        referred_by,
        is_from_identity_canister,
        canister_id: args
            .multi_user_canister_id
            .or_else(|| state.data.local_multi_user_canisters.canister_for_new_user()),
        openchat_bot_messages,
    })
}

fn commit(
    principal: Principal,
    user_id: UserId,
    username: String,
    email: Option<String>,
    referred_by: Option<UserId>,
    is_from_identity_canister: bool,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    state.data.local_users.add(user_id, principal, now);
    state.data.global_users.add(principal, user_id, UserType::User);
    let canister_id = user_id.canister_id();
    state.data.local_multi_user_canisters.on_user_added(&canister_id);
    // Indexes aren't reused, so once the last one is given out the canister can take no more users.
    // Marking it now saves the next registration from trying it
    if user_id.index() == MAX_USER_INDEX {
        state.data.local_multi_user_canisters.mark_full(&canister_id);
    }

    state.push_event_to_user_index(
        UserIndexEvent::UserRegistered(Box::new(UserRegistered {
            principal,
            user_id,
            username: username.clone(),
            email,
            referred_by,
            is_from_identity_canister,
        })),
        now,
    );

    // The referrer is told by whichever LocalUserIndex holds them by their latest id, since the
    // UserIndex tells every other LocalUserIndex of the registration
    if let Some(referred_by) = referred_by {
        state.push_event_to_user(
            referred_by,
            UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered { user_id, username })),
            now,
        );
    }
}

fn welcome_messages() -> Vec<String> {
    const WELCOME_MESSAGES: &[&str] = &[
        "Welcome to OpenChat!",
        "I am the OpenChat bot. I will send you messages to let you know about events that don't belong to any other chat, \
            such as if crypto has been deposited into your OpenChat account(s) or if you've been removed from a group. In \
            the future you'll be able to ask me questions or send me commands.",
        "Please join the [OpenChat](/community/dgegb-daaaa-aaaar-arlhq-cai) community to find out more about OpenChat, take \
            part in governance, request new features, report bugs or just chat.",
        "To discover more communities click the \"Explore communities\" icon near the bottom of the navigation bar or [follow this link](/communities).",
    ];

    WELCOME_MESSAGES.iter().map(|t| t.to_string()).collect()
}

fn validate_public_key(caller: Principal, public_key: &[u8], identity_canister_id: CanisterId) -> Result<bool, String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);
    if canister_id != identity_canister_id {
        return Err("PublicKey is not derived from the Identity canister".to_string());
    }

    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(canister_id == identity_canister_id)
    } else {
        Err("PublicKey does not match caller".to_string())
    }
}
