use crate::model::referral_codes::{ReferralCode, ReferralCodeError};
use crate::{mutate_state, RuntimeState, UserEvent, UserIndexEvent, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{min_cycles_balance, CREATE_CANISTER_CYCLES_FEE, USER_LIMIT};
use ledger_utils::default_ledger_account;
use local_user_index_canister::register_user::{Response::*, *};
use local_user_index_canister::ChildCanisterType;
use types::{BuildVersion, CanisterId, CanisterWasm, Cycles, MessageContentInitial, TextContent, UserId, UserType};
use user_canister::init::Args as InitUserCanisterArgs;
use user_canister::ReferredUserRegistered;
use user_index_canister::UserRegistered;
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::text_validation::{validate_username, UsernameValidationError};
use x509_parser::prelude::{FromDer, SubjectPublicKeyInfo};

#[update(candid = true, msgpack = true)]
#[trace]
async fn register_user(args: Args) -> Response {
    // Check the principal is derived from Internet Identity + check the username is valid
    let PrepareOk {
        caller,
        canister_id,
        canister_wasm,
        cycles_to_use,
        referred_by,
        is_from_identity_canister,
        init_canister_args,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let wasm_version = canister_wasm.version;

    match canister::create_and_install(
        canister_id,
        canister_wasm,
        init_canister_args,
        cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            let user_id = canister_id.into();
            mutate_state(|state| {
                commit(
                    caller,
                    user_id,
                    args.username,
                    wasm_version,
                    referred_by,
                    is_from_identity_canister,
                    state,
                )
            });
            Success(SuccessResult {
                user_id,
                icp_account: default_ledger_account(user_id.into()),
            })
        }
        Err(error) => {
            mutate_state(|state| rollback(&caller, &error, state));
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareOk {
    caller: Principal,
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    referred_by: Option<UserId>,
    is_from_identity_canister: bool,
    init_canister_args: InitUserCanisterArgs,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = state.env.caller();

    if state.data.global_users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
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
                })
            }
        }
    }

    match validate_username(&args.username) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(s)) => return Err(UsernameTooShort(s.min_length as u16)),
        Err(UsernameValidationError::TooLong(l)) => return Err(UsernameTooLong(l.max_length as u16)),
        Err(UsernameValidationError::Invalid) => return Err(UsernameInvalid),
    };

    let openchat_bot_messages = if referral_code
        .as_ref()
        .filter(|c| matches!(c, ReferralCode::BtcMiami(_)))
        .is_some()
    {
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
        let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, min_cycles_balance(state.data.test_mode)) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let canister_id = state.data.canister_pool.pop();
    let canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::User).wasm.clone();

    let referred_by = referral_code
        .and_then(|c| c.user())
        .filter(|user_id| state.data.global_users.contains(user_id));

    #[allow(deprecated)]
    let init_canister_args = InitUserCanisterArgs {
        owner: caller,
        group_index_canister_id: state.data.group_index_canister_id,
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id: state.env.canister_id(),
        notifications_canister_id: state.data.notifications_canister_id,
        proposals_bot_canister_id: state.data.proposals_bot_canister_id,
        escrow_canister_id: state.data.escrow_canister_id,
        wasm_version: canister_wasm.version,
        username: args.username.clone(),
        openchat_bot_messages,
        video_call_operators: state.data.video_call_operators.clone(),
        referred_by,
        test_mode: state.data.test_mode,
        bot_api_gateway_canister_id: Principal::anonymous(),
    };

    crate::jobs::topup_canister_pool::start_job_if_required(state, None);

    Ok(PrepareOk {
        caller,
        canister_id,
        canister_wasm,
        cycles_to_use,
        referred_by,
        is_from_identity_canister,
        init_canister_args,
    })
}

fn commit(
    principal: Principal,
    user_id: UserId,
    username: String,
    wasm_version: BuildVersion,
    referred_by: Option<UserId>,
    is_from_identity_canister: bool,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    state.data.local_users.add(user_id, principal, wasm_version, now);
    state.data.global_users.add(principal, user_id, UserType::User);

    state.push_event_to_user_index(
        UserIndexEvent::UserRegistered(Box::new(UserRegistered {
            principal,
            user_id,
            username: username.clone(),
            referred_by,
            is_from_identity_canister,
        })),
        now,
    );

    if let Some(referred_by) = referred_by {
        if state.data.local_users.contains(&referred_by) {
            state.push_event_to_user(
                referred_by,
                UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered { user_id, username })),
                now,
            );
        }
    }
}

fn rollback(principal: &Principal, error: &CreateAndInstallError, state: &mut RuntimeState) {
    state.data.local_users.mark_registration_failed(principal);

    if let CreateAndInstallError::InstallFailed(id, ..) = error {
        state.data.canister_pool.push(*id);
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
