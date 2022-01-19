use candid::Principal;
use ic_ledger_types::{AccountIdentifier, Memo, Subaccount, TransferArgs, MAINNET_LEDGER_CANISTER_ID};
use types::{CanisterId, Cycles, Error, ICP};

pub fn convert_to_subaccount(principal: &Principal) -> Subaccount {
    let mut subaccount = [0; std::mem::size_of::<Subaccount>()];
    let bytes = principal.as_slice();
    subaccount[0] = bytes.len().try_into().unwrap();
    subaccount[1..1 + bytes.len()].copy_from_slice(bytes);
    Subaccount(subaccount)
}

pub async fn transfer_to_minting_account(amount: ICP, canister_id: CanisterId) -> Result<(), Error> {
    let to_subaccount = convert_to_subaccount(&canister_id);
    let to = AccountIdentifier::new(&ic_ledger_types::MAINNET_CYCLES_MINTING_CANISTER_ID, &to_subaccount);

    let transfer_args = TransferArgs {
        memo: Memo(0),
        amount,
        fee: ic_ledger_types::DEFAULT_FEE,
        from_subaccount: None,
        to,
        created_at_time: None,
    };

    let transfer_result = ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, transfer_args).await?;
}
