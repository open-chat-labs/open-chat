use crate::env::ENV;
use crate::{CanisterIds, TestEnv, client};
use constants::{CHAT_SYMBOL, CHAT_TRANSFER_FEE, ICP_SYMBOL, ICP_TRANSFER_FEE};
use oc_error_codes::OCErrorCode;
use std::ops::Deref;
use testing::rng::{random_from_u128, random_principal};
use types::{TokenInfo, icrc1};
use user_canister::swap_tokens::{ExchangeArgs, ExchangeSwapArgs, TacoArgs};

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

// A user in a MultiUser canister holds their own funds in their own wallet, so the input is pulled
// from it via ICRC-2, against an approval made under the user's own spender subaccount, straight
// into the DEX's deposit account. There is no DEX in the test environment, so the swap stalls once it
// tries to notify the DEX.
#[test]
fn swap_in_multi_user_canister_pulls_input_from_wallet_into_dex_deposit_account() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_user_in_multi_user_canister(env, canister_ids);

    let input_amount = ONE_ICP;
    let wallet_balance = 10 * ONE_ICP;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.principal, wallet_balance);
    // The input includes the fee for pulling it, which is charged to the wallet
    client::ledger::happy_path::approve(
        env,
        user.principal,
        canister_ids.icp_ledger,
        multi_user_spender(&user),
        input_amount,
    );

    let args = swap_args(canister_ids, input_amount, None);
    let swap_id = args.swap_id;
    let pool = args.exchange_args.swap_canister_id();
    let response = client::user::swap_tokens(env, user.principal, user.canister(), &args);
    assert!(
        matches!(response, user_canister::swap_tokens::Response::Error(_)),
        "{response:?}"
    );

    let status = swap_status(env, &user, swap_id);
    assert!(status.funded_from_wallet.is_none(), "{status:?}");
    assert!(matches!(status.transfer_or_approval, Some(Ok(_))), "{status:?}");
    assert!(matches!(status.notify_dex, Some(Err(_))), "{status:?}");
    assert!(status.withdraw_from_dex.is_none(), "{status:?}");

    // The wallet paid for the approval and the input, which includes the fee for pulling it, and
    // the rest of the input went straight to the DEX's deposit account for the MultiUser canister
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.principal),
        wallet_balance - input_amount - ICP_TRANSFER_FEE
    );
    let deposit_account = icrc1::Account {
        owner: pool,
        subaccount: Some(ledger_utils::convert_to_subaccount(&user.canister()).0),
    };
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, deposit_account),
        input_amount - ICP_TRANSFER_FEE
    );
}

#[test]
fn swap_in_multi_user_canister_without_approval_fails() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user = client::register_user_in_multi_user_canister(env, canister_ids);
    let wallet_balance = 10 * ONE_ICP;
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user.principal, wallet_balance);

    let args = swap_args(canister_ids, ONE_ICP, None);
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
    assert!(matches!(status.transfer_or_approval, Some(Err(_))), "{status:?}");
    assert!(status.notify_dex.is_none(), "{status:?}");
    assert_eq!(status.success, Some(false));
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user.principal),
        wallet_balance
    );
}

// TACO pays its output to the default account of whoever swapped, so a MultiUser canister couldn't
// tell which of its users it was for. The swap is refused before it starts, so is never recorded.
#[test]
fn swap_via_taco_in_multi_user_canister_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv { env, canister_ids, .. } = wrapper.env();

    let user = client::register_user_in_multi_user_canister(env, canister_ids);

    let mut args = swap_args(canister_ids, ONE_ICP, None);
    args.exchange_args = ExchangeArgs::Taco(TacoArgs {
        swap_canister_id: random_principal(),
        treasury_canister_id: random_principal(),
    });
    let response = client::user::swap_tokens(env, user.principal, user.canister(), &args);
    assert!(
        matches!(
            &response,
            user_canister::swap_tokens::Response::Error(e) if e.matches_code(OCErrorCode::InvalidRequest)
        ),
        "{response:?}"
    );

    let response = client::user::token_swap_status(
        env,
        user.principal,
        user.canister(),
        &user_canister::token_swap_status::Args { swap_id: args.swap_id },
    );
    assert!(
        matches!(
            &response,
            user_canister::token_swap_status::Response::Error(e) if e.matches_code(OCErrorCode::SwapNotFound)
        ),
        "{response:?}"
    );
}

// The account a user in a MultiUser canister approves for their canister to pull from their wallet
fn multi_user_spender(user: &crate::User) -> icrc1::Account {
    icrc1::Account {
        owner: user.canister(),
        subaccount: Some(ledger_utils::spender_subaccount(user.principal)),
    }
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
