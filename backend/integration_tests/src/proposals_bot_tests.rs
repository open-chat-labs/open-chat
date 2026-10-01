use crate::env::ENV;
use crate::utils::now_nanos;
use crate::{TestEnv, client};
use candid::Principal;
use constants::{CHAT_SYMBOL, CHAT_TRANSFER_FEE};
use pocket_ic::PocketIc;
use proposals_bot_canister::{ProposalToSubmit, ProposalToSubmitAction, submit_proposal};
use std::ops::Deref;
use testing::rng::{random_principal, random_string};
use types::{CanisterId, icrc2};

// The ProposalsBot pulls a proposal's fee from whichever account has approved it, as spender. So
// it only takes the fee from the caller's own wallet, and only into its own account, else anyone
// could spend an approval someone else had made to it.
//
// No SNS governance canister is installed in these tests, so no proposal is ever submitted: a caller
// who names their own wallet gets as far as being told the governance canister isn't supported.
#[test]
fn proposal_fee_is_only_taken_from_the_callers_own_wallet() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let alice = client::register_user(env, canister_ids);
    let bob = client::register_user_in_multi_user_canister(env, canister_ids);
    let mallory = client::register_user(env, canister_ids);

    // Alice's wallet is her User canister's account, and Bob's, as a user in a MultiUser canister,
    // is his principal's. Each holds CHAT and has approved the ProposalsBot to pull it.
    let alice_wallet = alice.canister();
    let bob_wallet = bob.principal;
    let amount = 100_000_000;
    let balance = 10 * amount;
    for wallet in [alice_wallet, bob_wallet] {
        client::ledger::happy_path::transfer(
            env,
            *controller,
            canister_ids.chat_ledger,
            wallet,
            balance + CHAT_TRANSFER_FEE,
        );
        client::ledger::happy_path::approve(env, wallet, canister_ids.chat_ledger, canister_ids.proposals_bot, balance);
    }

    let submit = |env: &mut PocketIc, sender: Principal, from: Principal, to: Principal| {
        let now = now_nanos(env);
        client::proposals_bot::submit_proposal(
            env,
            sender,
            canister_ids.proposals_bot,
            &submit_proposal::Args {
                governance_canister_id: random_principal(),
                proposal: ProposalToSubmit {
                    title: random_string(),
                    summary: random_string(),
                    url: String::new(),
                    action: ProposalToSubmitAction::Motion,
                },
                transaction: icrc2::PendingCryptoTransaction {
                    ledger: canister_ids.chat_ledger,
                    token_symbol: CHAT_SYMBOL.to_string(),
                    amount,
                    from: from.into(),
                    to: to.into(),
                    fee: CHAT_TRANSFER_FEE,
                    memo: None,
                    created: now,
                },
            },
        )
    };
    let proposals_bot: CanisterId = canister_ids.proposals_bot;

    // Mallory can't have the fee taken from Alice's or Bob's wallet, whether into the ProposalsBot's
    // account or her own, nor from her own wallet into anyone's account but the ProposalsBot's
    for (from, to) in [
        (alice_wallet, proposals_bot),
        (alice_wallet, mallory.principal),
        (bob_wallet, proposals_bot),
        (bob_wallet, mallory.principal),
        (mallory.canister(), mallory.principal),
    ] {
        let response = submit(env, mallory.principal, from, to);
        assert!(
            matches!(response, submit_proposal::Response::PaymentFailed(_)),
            "{from} to {to}: {response:?}"
        );
    }

    // Alice and Bob, naming their own wallets, get past the check
    for (sender, wallet) in [(alice.principal, alice_wallet), (bob.principal, bob_wallet)] {
        let response = submit(env, sender, wallet, proposals_bot);
        assert!(
            matches!(response, submit_proposal::Response::GovernanceCanisterNotSupported),
            "{response:?}"
        );
    }

    // Nothing was taken from either wallet
    for wallet in [alice_wallet, bob_wallet] {
        assert_eq!(
            client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, wallet),
            balance
        );
    }
}
