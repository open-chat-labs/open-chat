use crate::{generate_query_call, generate_update_call};

// Queries
generate_query_call!(icrc1_balance_of);

// Updates
generate_update_call!(icrc1_transfer);

pub mod icrc1_balance_of {
    pub type Args = ic_icrc1::Account;
    pub type Response = candid::Nat;
}

pub mod icrc1_transfer {
    pub type Args = ic_icrc1::endpoints::TransferArg;
    pub type Response = Result<candid::Nat, ic_icrc1::endpoints::TransferError>;
}

pub mod happy_path {
    use super::*;
    use candid::Principal;
    use ic_base_types::PrincipalId;
    use ic_icrc1::endpoints::NumTokens;
    use ic_icrc1::Account;
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
                to: Account::from(PrincipalId(recipient)),
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
                owner: PrincipalId(principal),
                subaccount: None,
            },
        )
        .0
        .try_into()
        .unwrap()
    }
}
