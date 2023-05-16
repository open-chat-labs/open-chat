use crate::model::btc_miami_payments_queue::PendingPayment;
use crate::model::referral_codes::ReferralCode;
use crate::timer_job_types::{AddUserToSatoshiDice, JoinUserToGroup, TimerJob};
use crate::{mutate_state, RuntimeState, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ledger_utils::default_ledger_account;
use local_user_index_canister::register_user::{Response::*, *};
use types::{CanisterId, CanisterWasm, Cycles, MessageContent, TextContent, UserId, Version};
use user_canister::init::Args as InitUserCanisterArgs;
use user_canister::{Event as UserEvent, ReferredUserRegistered};
use user_index_canister::{Event as UserIndexEvent, UserRegistered};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, MIN_CYCLES_BALANCE};
use utils::username_validation::{validate_username, UsernameValidationError};
use x509_parser::prelude::FromDer;
use x509_parser::x509::SubjectPublicKeyInfo;

pub const USER_LIMIT: usize = 150_000;

#[update]
#[trace]
async fn register_user(args: Args) -> Response {
    // Check the principal is derived from Internet Identity + check the username is valid
    let PrepareOk {
        caller,
        canister_id,
        canister_wasm,
        cycles_to_use,
        referral_code,
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
            mutate_state(|state| commit(caller, user_id, args.username, wasm_version, referral_code, state));
            Success(SuccessResult {
                user_id,
                icp_account: default_ledger_account(user_id.into()),
            })
        }
        Err(error) => {
            if let CreateAndInstallError::InstallFailed(id, ..) = error {
                mutate_state(|state| state.data.canister_pool.push(id));
            }
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareOk {
    caller: Principal,
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    referral_code: Option<ReferralCode>,
    init_canister_args: InitUserCanisterArgs,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = runtime_state.env.caller();
    let mut referral_code = None;

    if runtime_state.data.global_users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if let Err(error) = validate_public_key(caller, &args.public_key, runtime_state.data.internet_identity_canister_id) {
        return Err(PublicKeyInvalid(error));
    }

    if runtime_state.data.global_users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if runtime_state.data.global_users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    if let Some(code) = &args.referral_code {
        referral_code = match runtime_state.data.referral_codes.check(code) {
            Some(t) => Some(t),
            None => return Err(ReferralCodeInvalid),
        }
    }

    match validate_username(&args.username) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(min_length)) => return Err(UsernameTooShort(min_length)),
        Err(UsernameValidationError::TooLong(max_length)) => return Err(UsernameTooLong(max_length)),
        Err(UsernameValidationError::Invalid) => return Err(UsernameInvalid),
    };

    let openchat_bot_messages = if referral_code
        .as_ref()
        .filter(|c| matches!(c, ReferralCode::BtcMiami(_)))
        .is_some()
    {
        vec![
            MessageContent::Text(TextContent {
                text: "Welcome to OpenChat!!".to_string(),
            }),
            MessageContent::Text(TextContent {
                text: format!("Wait a moment {}, your SATS are coming below 👇", args.username),
            }),
        ]
    } else {
        welcome_messages()
            .into_iter()
            .map(|t| MessageContent::Text(TextContent { text: t }))
            .collect()
    };

    let cycles_to_use = if runtime_state.data.canister_pool.is_empty() {
        let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let canister_id = runtime_state.data.canister_pool.pop();
    let canister_wasm = runtime_state.data.user_canister_wasm_for_new_canisters.clone();
    let init_canister_args = InitUserCanisterArgs {
        owner: caller,
        group_index_canister_id: runtime_state.data.group_index_canister_id,
        user_index_canister_id: runtime_state.data.user_index_canister_id,
        local_user_index_canister_id: runtime_state.env.canister_id(),
        notifications_canister_id: runtime_state.data.notifications_canister_id,
        wasm_version: canister_wasm.version,
        username: args.username.clone(),
        openchat_bot_messages,
        test_mode: runtime_state.data.test_mode,
    };

    crate::jobs::topup_canister_pool::start_job_if_required(runtime_state);

    Ok(PrepareOk {
        caller,
        canister_id,
        canister_wasm,
        cycles_to_use,
        referral_code,
        init_canister_args,
    })
}

fn commit(
    principal: Principal,
    user_id: UserId,
    username: String,
    wasm_version: Version,
    referral_code: Option<ReferralCode>,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    runtime_state.data.local_users.add(user_id, wasm_version, now);
    runtime_state.data.global_users.add(principal, user_id, false);

    runtime_state.push_event_to_user_index(UserIndexEvent::UserRegistered(Box::new(UserRegistered {
        principal,
        user_id,
        username: username.clone(),
        referred_by: referral_code.as_ref().and_then(|r| r.user()),
    })));

    match referral_code {
        Some(ReferralCode::User(referred_by)) => {
            if runtime_state.data.local_users.get(&referred_by).is_some() {
                runtime_state.push_event_to_user(
                    referred_by,
                    UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered { user_id, username })),
                );
            }
        }
        Some(ReferralCode::BtcMiami(code)) => {
            let test_mode = runtime_state.data.test_mode;

            // This referral code can only be used once so claim it
            runtime_state.data.referral_codes.claim(code, user_id, now);

            runtime_state.data.btc_miami_payments_queue.push(PendingPayment {
                amount: if test_mode { 50 } else { 50_000 }, // Approx $14
                timestamp: runtime_state.env.now_nanos(),
                recipient: user_id.into(),
            });
            crate::jobs::make_btc_miami_payments::start_job_if_required(runtime_state);

            let btc_miami_group =
                Principal::from_text(if test_mode { "ueyan-5iaaa-aaaaf-bifxa-cai" } else { "pbo6v-oiaaa-aaaar-ams6q-cai" })
                    .unwrap()
                    .into();

            runtime_state.data.timer_jobs.enqueue_job(
                TimerJob::JoinUserToGroup(JoinUserToGroup {
                    user_id,
                    group_id: btc_miami_group,
                    attempt: 0,
                }),
                now,
                now,
            );
            runtime_state.data.timer_jobs.enqueue_job(
                TimerJob::AddUserToSatoshiDice(AddUserToSatoshiDice { user_id, attempt: 0 }),
                now,
                now,
            );
        }
        _ => {}
    }
}

fn welcome_messages() -> Vec<String> {
    const WELCOME_MESSAGES: &[&str] = &[
        "Welcome to OpenChat!",
        "I am the OpenChat bot. I will send you messages to let you know about events that don't belong to any other chat, \
            such as if crypto has been deposited into your OpenChat account(s) or if you've been removed from a group. In \
            the future you'll be able to ask me questions or send me commands.",
        "\
- To follow announcements by the OpenChat team, join [Announcements](/kvvn5-aiaaa-aaaaf-aqznq-cai).
- To ask for help, join [OpenChat Help](/4stss-vaaaa-aaaar-amjda-cai).
- To follow software updates, join [OpenChat Updates](/eucat-raaaa-aaaaf-adn7q-cai).
- To request new features, join [Feature Requests](/vfaj4-zyaaa-aaaaf-aabya-cai).
- To report bugs, join [Bug Reports](/sycha-wyaaa-aaaaf-aabka-cai).
- To provide feedback in general, join the [Product Feedback](/s7dbu-3aaaa-aaaaf-aabkq-cai).
- To view, vote on and discuss governance proposals, join [OpenChat Proposals](/nsbx4-4iaaa-aaaar-afusa-cai).
- To introduce and discuss upcoming proposals, join [OpenChat Roadmap](/n2qig-viaaa-aaaar-ahviq-cai).",
        "Please keep posts relevant to each group. If you just want to say \"hi\", post in the [OpenChat](/vmdca-pqaaa-aaaaf-aabzq-cai) group."];

    WELCOME_MESSAGES.iter().map(|t| t.to_string()).collect()
}

fn validate_public_key(caller: Principal, public_key: &[u8], internet_identity_canister_id: CanisterId) -> Result<(), String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);
    if canister_id != internet_identity_canister_id {
        return Err("PublicKey is not derived from the InternetIdentity canister".to_string());
    }

    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(())
    } else {
        Err("PublicKey does not match caller".to_string())
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
