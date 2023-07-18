use crate::{generate_query_call, generate_update_call};
use candid::Nat;
use types::icrc1::{Account, NumTokens, TransferArg, TransferError};

// Queries
generate_query_call!(icrc1_balance_of);

// Updates
generate_update_call!(icrc1_transfer);

pub mod icrc1_balance_of {
    use super::*;

    pub type Args = Account;
    pub type Response = Nat;
}

pub mod icrc1_transfer {
    use super::*;

    pub type Args = TransferArg;
    pub type Response = Result<Nat, TransferError>;
}

pub mod happy_path {
    use super::*;
    use candid::Principal;
    use ic_ledger_types::BlockIndex;
    use ic_test_state_machine_client::StateMachine;
    use types::CanisterId;

    pub fn transfer(
        env: &mut StateMachine,
        sender: Principal,
        icp_ledger_canister_id: CanisterId,
        recipient: Principal,
        amount_e8s: u64,
    ) -> BlockIndex {
        icrc1_transfer(
            env,
            sender,
            icp_ledger_canister_id,
            &icrc1_transfer::Args {
                from_subaccount: None,
                to: Account::from(recipient),
                fee: None,
                created_at_time: None,
                memo: None,
                amount: NumTokens::from(amount_e8s),
            },
        )
        .unwrap()
        .0
        .try_into()
        .unwrap()
    }

    pub fn balance_of(env: &StateMachine, icp_ledger_canister_id: CanisterId, principal: Principal) -> u64 {
        icrc1_balance_of(
            env,
            Principal::anonymous(),
            icp_ledger_canister_id,
            &icrc1_balance_of::Args {
                owner: principal,
                subaccount: None,
            },
        )
        .0
        .try_into()
        .unwrap()
    }
}
