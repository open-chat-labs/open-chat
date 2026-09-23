use crate::model::referral_codes::{ReferralCode, ReferralCodeError};
use crate::updates::c2c_create_multi_user_canister::create_multi_user_canister;
use crate::{CHILD_CANISTER_INITIAL_CYCLES_BALANCE, RuntimeState, UserEvent, UserIndexEvent, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{CREATE_CANISTER_CYCLES_FEE, USER_LIMIT, min_cycles_balance};
use email_address::EmailAddress;
use local_user_index_canister::ChildCanisterType;
use local_user_index_canister::register_user::{Response::*, *};
use oc_error_codes::{OCError, OCErrorCode};
use rand::RngExt;
use tracing::error;
use types::{BuildVersion, CanisterId, CanisterWasm, Cycles, MessageContentInitial, TextContent, UserId, UserType};
use user_canister::ReferredUserRegistered;
use user_canister::init::Args as InitUserCanisterArgs;
use user_index_canister::UserRegistered;
use utils::canister;
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
        target,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let result = match target {
        Target::UserCanister {
            canister_id,
            canister_wasm,
            cycles_to_use,
            init_canister_args,
        } => create_user_canister(canister_id, canister_wasm, cycles_to_use, init_canister_args).await,
        Target::MultiUserCanister(existing) => {
            create_user_in_multi_user_canister(existing, caller, args.username.clone(), referred_by).await
        }
    };

    match result {
        Ok((user_id, wasm_version)) => {
            mutate_state(|state| {
                commit(
                    caller,
                    user_id,
                    args.username,
                    args.email,
                    wasm_version,
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

async fn create_user_canister(
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: Box<InitUserCanisterArgs>,
) -> Result<(UserId, BuildVersion), OCError> {
    let wasm_version = canister_wasm.version;

    match canister::create_and_install(
        canister_id,
        None,
        canister_wasm,
        candid::encode_one(&init_canister_args).unwrap(),
        cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => Ok((canister_id.into(), wasm_version)),
        Err((canister_id, error)) => {
            if let Some(id) = canister_id {
                mutate_state(|state| {
                    // If this canister is not controlled by the LocalUserIndex then installs into
                    // it can never succeed, so drop it from the pool and let the topup job replace
                    // it, else registrations would keep pulling the same unusable canisters out of
                    // the pool
                    if canister::is_invalid_controller_error(error.reject_code(), error.message()) {
                        error!(canister_id = %id, "Dropping canister from pool - LocalUserIndex is not a controller");
                        crate::jobs::topup_canister_pool::start_job_if_required(state, None);
                    } else {
                        state.data.canister_pool.push(id);
                    }
                });
            }
            Err(error.into())
        }
    }
}

async fn create_user_in_multi_user_canister(
    existing: Option<(CanisterId, BuildVersion)>,
    principal: Principal,
    username: String,
    referred_by: Option<UserId>,
) -> Result<(UserId, BuildVersion), OCError> {
    if let Some((canister_id, wasm_version)) = existing {
        match c2c_create_user(canister_id, principal, username.clone(), referred_by).await {
            // The canister is full, so fall through to creating a new one
            Err(error) if error.matches_code(OCErrorCode::UserLimitReached) => {}
            result => return result.map(|user_id| (user_id, wasm_version)),
        }
    }

    let canister_id = create_multi_user_canister().await?;
    let wasm_version = read_state(|state| {
        state
            .data
            .local_multi_user_canisters
            .get(&canister_id)
            .map(|c| c.wasm_version)
            .unwrap_or_else(BuildVersion::min)
    });
    let user_id = c2c_create_user(canister_id, principal, username, referred_by).await?;
    Ok((user_id, wasm_version))
}

async fn c2c_create_user(
    canister_id: CanisterId,
    principal: Principal,
    username: String,
    referred_by: Option<UserId>,
) -> Result<UserId, OCError> {
    match multi_user_canister_c2c_client::c2c_create_user(
        canister_id,
        &multi_user_canister::c2c_create_user::Args {
            principal,
            username,
            referred_by,
        },
    )
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
    target: Target,
}

enum Target {
    UserCanister {
        canister_id: Option<CanisterId>,
        canister_wasm: CanisterWasm,
        cycles_to_use: Cycles,
        init_canister_args: Box<InitUserCanisterArgs>,
    },
    // The canister to add the user to. If there is none, or it is full, a new one is created
    MultiUserCanister(Option<(CanisterId, BuildVersion)>),
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = state.env.caller();

    if state.data.global_users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    let use_multi_user_canister = args.use_multi_user_canister.unwrap_or_default();
    if use_multi_user_canister && !state.data.test_mode {
        return Err(Error(
            OCErrorCode::InvalidRequest.with_message("MultiUser canisters can only be requested in test mode"),
        ));
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

    let referred_by = referral_code
        .and_then(|c| c.user())
        .filter(|user_id| state.data.global_users.contains(user_id));

    if use_multi_user_canister {
        return Ok(PrepareOk {
            caller,
            referred_by,
            is_from_identity_canister,
            target: Target::MultiUserCanister(state.data.local_multi_user_canisters.canister_for_new_user()),
        });
    }

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

    let cycles_to_use = if state.data.canister_pool.is_empty() {
        let cycles_required = CHILD_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, min_cycles_balance(state.data.test_mode)) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let canister_id = state.data.canister_pool.pop();
    let canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::User).wasm.clone();

    #[expect(deprecated)]
    let init_canister_args = InitUserCanisterArgs {
        owner: caller,
        group_index_canister_id: state.data.group_index_canister_id,
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id: state.env.canister_id(),
        identity_canister_id: state.data.identity_canister_id,
        notifications_canister_id: CanisterId::anonymous(),
        proposals_bot_canister_id: CanisterId::anonymous(),
        escrow_canister_id: state.data.escrow_canister_id,
        wasm_version: canister_wasm.version,
        username: args.username.clone(),
        openchat_bot_messages,
        video_call_operators: state.data.video_call_operators.clone(),
        referred_by,
        test_mode: state.data.test_mode,
        rng_seed: state.env.rng().random(),
        bot_api_gateway_canister_id: Principal::anonymous(),
    };

    crate::jobs::topup_canister_pool::start_job_if_required(state, None);

    Ok(PrepareOk {
        caller,
        referred_by,
        is_from_identity_canister,
        target: Target::UserCanister {
            canister_id,
            canister_wasm,
            cycles_to_use,
            init_canister_args: Box::new(init_canister_args),
        },
    })
}

#[expect(clippy::too_many_arguments)]
fn commit(
    principal: Principal,
    user_id: UserId,
    username: String,
    email: Option<String>,
    wasm_version: BuildVersion,
    referred_by: Option<UserId>,
    is_from_identity_canister: bool,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    state.data.local_users.add(user_id, principal, wasm_version, now);
    state.data.global_users.add(principal, user_id, UserType::User);
    if user_id.index() != 0 {
        state.data.local_multi_user_canisters.on_user_added(&user_id.canister_id());
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

    if let Some(referred_by) = referred_by
        && state.data.local_users.contains(&referred_by)
    {
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

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
