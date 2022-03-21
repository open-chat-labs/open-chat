use crate::block_on;
use canister_client::operations::*;
use canister_client::utils::{build_ic_agent, build_identity, build_management_canister};
use canister_client::TestIdentity;
use ic_fondue::ic_manager::IcHandle;
use types::{
    CryptocurrencyContent, CryptocurrencyDeposit, CryptocurrencyTransaction, CryptocurrencyTransfer, CyclesDeposit,
    CyclesTransfer, MessageContent, PendingCyclesTransfer, Transaction,
};

pub fn send_cycles_tests(handle: IcHandle, ctx: &fondue::pot::Context) {
    block_on(send_cycles_tests_impl(handle, ctx));
}

async fn send_cycles_tests_impl(handle: IcHandle, ctx: &fondue::pot::Context) {
    let endpoint = handle.public_api_endpoints.first().unwrap();
    endpoint.assert_ready(ctx).await;
    let url = endpoint.url.to_string();
    let identity = build_identity(TestIdentity::Controller);
    let canister_ids = create_and_install_service_canisters(identity, url.clone(), true).await;

    let (user1_id, user2_id) = register_2_default_users(url.clone(), canister_ids.user_index).await;

    let user1_identity = build_identity(TestIdentity::User1);
    let user2_identity = build_identity(TestIdentity::User2);

    let (user1_agent, user2_agent) = futures::future::join(
        build_ic_agent(url.clone(), user1_identity),
        build_ic_agent(url, user2_identity),
    )
    .await;

    let management_canister = build_management_canister(&user1_agent);
    let cycles_wallet_canister_id = create_cycles_wallet(&management_canister).await;

    const ONE_HUNDRED_BILLION: u128 = 100_000_000_000;
    const ONE_TRILLION: u128 = 1_000_000_000_000;

    print!("Depositing cycles into user1's canister... ");
    send_cycles(&user1_agent, &cycles_wallet_canister_id, user1_id.into(), ONE_TRILLION).await;
    println!("Ok");

    print!("Checking user1's cycles balance + deposit is in list of transactions... ");
    let initial_state_args = user_canister::initial_state::Args {};
    let initial_state_timestamp;
    match user_canister_client::initial_state(&user1_agent, &user1_id.into(), &initial_state_args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(result) => {
            assert_eq!(result.cycles_balance, ONE_TRILLION);
            assert_eq!(result.transactions.len(), 1);
            let transaction = &result.transactions[0].transaction;
            if let Transaction::Cryptocurrency(CryptocurrencyTransaction::Deposit(CryptocurrencyDeposit::Cycles(
                CyclesDeposit::Completed(c),
            ))) = transaction
            {
                assert_eq!(c.from, cycles_wallet_canister_id);
                assert_eq!(c.cycles, ONE_TRILLION);
            } else {
                panic!("Unexpected transaction: {transaction:?}");
            }
            initial_state_timestamp = result.timestamp;
        }
        response => panic!("InitialState returned an error: {response:?}"),
    };
    println!("Ok");

    print!("Sending cycles from user1 to user2... ");
    let send_message_args = user_canister::send_message::Args {
        message_id: 1.into(),
        recipient: user2_id,
        sender_name: "TEST!".to_string(),
        content: MessageContent::Cryptocurrency(CryptocurrencyContent {
            transfer: CryptocurrencyTransfer::Cycles(CyclesTransfer::Pending(PendingCyclesTransfer {
                cycles: ONE_HUNDRED_BILLION,
                recipient: user2_id,
            })),
            caption: Some("abc".to_string()),
        }),
        replies_to: None,
    };
    send_direct_message_with_cryptocurrency_transfer(&user1_agent, user1_id, &send_message_args).await;
    println!("Ok");

    print!("Checking user1's cycles balance + transfer is in list of transactions... ");
    let updates_args = user_canister::updates::Args {
        updates_since: user_canister::updates::UpdatesSince {
            timestamp: initial_state_timestamp,
            group_chats: Vec::new(),
        },
    };
    match user_canister_client::updates(&user1_agent, &user1_id.into(), &updates_args)
        .await
        .unwrap()
    {
        user_canister::updates::Response::Success(result) => {
            assert_eq!(result.cycles_balance, Some(9 * ONE_HUNDRED_BILLION));
            assert_eq!(result.transactions.len(), 1);
            let transaction = &result.transactions[0].transaction;
            if let Transaction::Cryptocurrency(CryptocurrencyTransaction::Transfer(CryptocurrencyTransfer::Cycles(
                CyclesTransfer::Completed(c),
            ))) = transaction
            {
                assert_eq!(c.sender, user1_id);
                assert_eq!(c.recipient, user2_id);
                assert_eq!(c.cycles, ONE_HUNDRED_BILLION);
            } else {
                panic!("Unexpected transaction: {transaction:?}");
            }
        }
        response => panic!("Updates returned an error: {response:?}"),
    }
    println!("Ok");

    print!("Checking user2's cycles balance + transfer is in list of transactions... ");
    match user_canister_client::initial_state(&user2_agent, &user2_id.into(), &initial_state_args)
        .await
        .unwrap()
    {
        user_canister::initial_state::Response::Success(result) => {
            assert_eq!(result.cycles_balance, ONE_HUNDRED_BILLION);
            assert_eq!(result.transactions.len(), 1);
            let transaction = &result.transactions[0].transaction;
            if let Transaction::Cryptocurrency(CryptocurrencyTransaction::Transfer(CryptocurrencyTransfer::Cycles(
                CyclesTransfer::Completed(c),
            ))) = transaction
            {
                assert_eq!(c.sender, user1_id);
                assert_eq!(c.recipient, user2_id);
                assert_eq!(c.cycles, ONE_HUNDRED_BILLION);
            } else {
                panic!("Unexpected transaction: {transaction:?}");
            }
        }
        response => panic!("InitialState returned an error: {response:?}"),
    };
    println!("Ok");
}
