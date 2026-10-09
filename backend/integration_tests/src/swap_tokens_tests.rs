use crate::env::ENV;
use crate::{CanisterIds, TestEnv, client};
use constants::{CHAT_SYMBOL, CHAT_TRANSFER_FEE, ICP_SYMBOL, ICP_TRANSFER_FEE};
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use testing::rng::{random_from_u128, random_principal};
use types::{TokenInfo, icrc1};
use user_canister::swap_tokens::{ExchangeArgs, ExchangeSwapArgs};

const ONE_ICP: u128 = 100_000_000;

// A swap funded from an account OpenChat does not control, pulled via ICRC-2 against an allowance
// that account granted to the user's canister. This is how swapping from an external wallet works.
// There is no DEX in the test environment, so the swap stalls once it tries to notify the DEX, by
// which point the input has been pulled into the user's account and sent on to the DEX.
#[test]
fn swap_from_approved_account_pulls_input_from_that_account() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    let input_amount = ONE_ICP;
    let wallet_balance = 10 * ONE_ICP;
    let external_wallet = random_principal();
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, external_wallet, wallet_balance);
    // The allowance has to cover the transfer fee too, since that is charged to the `from` account.
    client::ledger::happy_path::approve(
        env,
        external_wallet,
        canister_ids.icp_ledger,
        user.user_id,
        input_amount + ICP_TRANSFER_FEE,
    );

    let args = swap_args(canister_ids, input_amount, Some(external_wallet.into()));
    let swap_id = args.swap_id;
    let response = client::user::swap_tokens(env, user.principal, user.canister(), &args);
    assert!(
        matches!(response, user_canister::swap_tokens::Response::Error(_)),
        "{response:?}"
    );

    let status = swap_status(env, &user, swap_id);
    assert!(matches!(status.funded_from_wallet, Some(Ok(_))), "{status:?}");
    assert!(matches!(status.transfer_or_approval, Some(Ok(_))), "{status:?}");
    assert!(matches!(status.notify_dex, Some(Err(_))), "{status:?}");

    // The wallet paid for the approval, the input and the fee for pulling it. The user's account
    // received the input and sent it all on to the DEX, less the fee for doing so.
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, external_wallet),
        wallet_balance - input_amount - 2 * ICP_TRANSFER_FEE
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.user_id),
        0
    );
}

#[test]
fn swap_from_account_without_allowance_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    let external_wallet = random_principal();
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, external_wallet, 10 * ONE_ICP);

    let args = swap_args(canister_ids, ONE_ICP, Some(external_wallet.into()));
    let swap_id = args.swap_id;
    let response = client::user::swap_tokens(env, user.principal, user.canister(), &args);
    assert!(
        matches!(
            &response,
            user_canister::swap_tokens::Response::Error(e) if e.matches_code(OCErrorCode::InsufficientAllowance)
        ),
        "{response:?}"
    );

    // The swap stopped before anything was sent to the DEX
    let status = swap_status(env, &user, swap_id);
    assert!(matches!(status.funded_from_wallet, Some(Err(_))), "{status:?}");
    assert!(status.transfer_or_approval.is_none(), "{status:?}");
    assert_eq!(status.success, Some(false));
}

// Spending from our own account would need an approval we had granted ourselves, so it is rejected
// up front rather than left to fail at the ledger.
#[test]
fn swap_from_own_account_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user(env, canister_ids);

    let args = swap_args(canister_ids, ONE_ICP, Some(icrc1::Account::legacy_for_user(user.user_id)));
    let response = client::user::swap_tokens(env, user.principal, user.canister(), &args);
    assert!(
        matches!(
            &response,
            user_canister::swap_tokens::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)
        ),
        "{response:?}"
    );
}

// A user in a MultiUser canister holds their own funds, so swaps straight from their own wallet, which
// the canister only records, so that a swap which doesn't finish can be found again later
#[test]
fn swap_made_by_user_in_multi_user_canister_is_unfinished_until_marked_completed() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user_in_multi_user_canister(env, canister_ids);
    let swap_id = random_from_u128();
    mark_started(env, &user, canister_ids, swap_id);

    // The same swap can't be started twice
    let response = client::user::mark_token_swap_started(
        env,
        user.principal,
        user.canister(),
        &mark_started_args(canister_ids, swap_id),
    );
    assert!(
        matches!(&response, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::AlreadyAdded)),
        "{response:?}"
    );

    assert_eq!(unfinished_swap_ids(env, &user), vec![swap_id]);
    let status = swap_status(env, &user, swap_id);
    assert!(status.success.is_none(), "{status:?}");
    assert!(!has_swapped_from_wallet(env, &user));

    let amount_out = 3 * ONE_ICP;
    mark_completed(env, &user, swap_id, Ok(amount_out));

    assert!(unfinished_swap_ids(env, &user).is_empty());
    let status = swap_status(env, &user, swap_id);
    assert_eq!(status.success, Some(true));
    assert!(
        matches!(status.amount_swapped, Some(Ok(Ok(a))) if a == amount_out),
        "{status:?}"
    );
    assert!(
        matches!(status.withdraw_from_dex, Some(Ok(a)) if a == amount_out),
        "{status:?}"
    );
    assert!(has_swapped_from_wallet(env, &user));

    // Marking it completed again leaves it as it was
    mark_completed(env, &user, swap_id, Err("too late".to_string()));
    let status = swap_status(env, &user, swap_id);
    assert_eq!(status.success, Some(true));
    assert!(
        matches!(status.amount_swapped, Some(Ok(Ok(a))) if a == amount_out),
        "{status:?}"
    );
}

#[test]
fn failed_swap_made_by_user_in_multi_user_canister_earns_no_achievement() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user_in_multi_user_canister(env, canister_ids);
    let swap_id = random_from_u128();
    mark_started(env, &user, canister_ids, swap_id);
    mark_completed(env, &user, swap_id, Err("slippage".to_string()));

    assert!(unfinished_swap_ids(env, &user).is_empty());
    let status = swap_status(env, &user, swap_id);
    assert_eq!(status.success, Some(false));
    assert!(
        matches!(&status.amount_swapped, Some(Ok(Err(e))) if e == "slippage"),
        "{status:?}"
    );
    assert!(status.withdraw_from_dex.is_none(), "{status:?}");
    assert!(!has_swapped_from_wallet(env, &user));
}

#[test]
fn completing_swap_which_was_never_started_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user_in_multi_user_canister(env, canister_ids);
    let response = client::user::mark_token_swap_completed(
        env,
        user.principal,
        user.canister(),
        &user_canister::mark_token_swap_completed::Args {
            swap_id: random_from_u128(),
            result: Ok(ONE_ICP),
        },
    );
    assert!(
        matches!(&response, types::UnitResult::Error(e) if e.matches_code(OCErrorCode::SwapNotFound)),
        "{response:?}"
    );
}

fn mark_started_args(canister_ids: &CanisterIds, swap_id: u128) -> user_canister::mark_token_swap_started::Args {
    let args = swap_args(canister_ids, ONE_ICP, None);
    user_canister::mark_token_swap_started::Args {
        swap_id,
        input_token: args.input_token,
        output_token: args.output_token,
        input_amount: args.input_amount,
        exchange_args: args.exchange_args,
        min_output_amount: args.min_output_amount,
    }
}

fn mark_started(env: &mut pocket_ic::PocketIc, user: &crate::User, canister_ids: &CanisterIds, swap_id: u128) {
    let response = client::user::mark_token_swap_started(
        env,
        user.principal,
        user.canister(),
        &mark_started_args(canister_ids, swap_id),
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");
}

fn mark_completed(env: &mut pocket_ic::PocketIc, user: &crate::User, swap_id: u128, result: Result<u128, String>) {
    let response = client::user::mark_token_swap_completed(
        env,
        user.principal,
        user.canister(),
        &user_canister::mark_token_swap_completed::Args { swap_id, result },
    );
    assert!(matches!(response, types::UnitResult::Success), "{response:?}");
}

fn unfinished_swap_ids(env: &pocket_ic::PocketIc, user: &crate::User) -> Vec<u128> {
    let user_canister::unfinished_token_swaps::Response::Success(swaps) =
        client::user::unfinished_token_swaps(env, user.principal, user.canister(), &types::Empty {});
    swaps.into_iter().map(|s| s.args.swap_id).collect()
}

fn has_swapped_from_wallet(env: &pocket_ic::PocketIc, user: &crate::User) -> bool {
    client::user::happy_path::initial_state(env, user)
        .achievements
        .iter()
        .any(|e| {
            matches!(
                &e.reason,
                types::ChitEventType::Achievement(types::Achievement::SwappedFromWallet)
            )
        })
}

fn swap_args(
    canister_ids: &CanisterIds,
    input_amount: u128,
    from_account: Option<icrc1::Account>,
) -> user_canister::swap_tokens::Args {
    user_canister::swap_tokens::Args {
        swap_id: random_from_u128(),
        input_token: TokenInfo {
            symbol: ICP_SYMBOL.to_string(),
            ledger: canister_ids.icp_ledger,
            decimals: 8,
            fee: ICP_TRANSFER_FEE,
        },
        output_token: TokenInfo {
            symbol: CHAT_SYMBOL.to_string(),
            ledger: canister_ids.chat_ledger,
            decimals: 8,
            fee: CHAT_TRANSFER_FEE,
        },
        input_amount,
        // A pool canister which doesn't exist, so the swap can't get past notifying the DEX
        exchange_args: ExchangeArgs::ICPSwap(ExchangeSwapArgs {
            swap_canister_id: random_principal(),
            zero_for_one: true,
        }),
        min_output_amount: 1,
        from_account,
        pin: None,
    }
}

fn swap_status(
    env: &pocket_ic::PocketIc,
    user: &crate::User,
    swap_id: u128,
) -> user_canister::token_swap_status::TokenSwapStatus {
    match client::user::token_swap_status(
        env,
        user.principal,
        user.canister(),
        &user_canister::token_swap_status::Args { swap_id },
    ) {
        user_canister::token_swap_status::Response::Success(status) => status,
        response => panic!("{response:?}"),
    }
}
