use crate::mutate_state;
use serde::{Deserialize, Serialize};
use types::{CompletedCyclesTransfer, CryptocurrencyTransfer, CyclesTransfer, FailedCyclesTransfer, PendingCyclesTransfer};

#[derive(Serialize, Deserialize, Clone)]
pub struct CyclesTransferDetails {
    pub index: u32,
    pub transfer: CompletedCyclesTransfer,
}

// If the user has enough cycles to cover the transfer, reduce their balance by the transfer
// amount and log the pending transfer, else log a failed transfer.
pub fn start_cycles_transfer(pending_transfer: PendingCyclesTransfer) -> Result<CyclesTransferDetails, FailedCyclesTransfer> {
    mutate_state(|state| {
        let now = state.env.now();

        if state.data.user_cycles_balance.try_subtract(pending_transfer.cycles, now) {
            let my_user_id = state.env.canister_id().into();
            let completed_transfer = pending_transfer.completed(my_user_id);
            let index = state
                .data
                .transactions
                .add(CryptocurrencyTransfer::Cycles(CyclesTransfer::Pending(pending_transfer)), now);

            Ok(CyclesTransferDetails {
                index,
                transfer: completed_transfer,
            })
        } else {
            let error_message = "Insufficient cycles".to_string();
            let failed_transfer = pending_transfer.failed(error_message);

            let crypto_transfer = CryptocurrencyTransfer::Cycles(CyclesTransfer::Failed(failed_transfer.clone()));
            state.data.transactions.add(crypto_transfer, now);

            Err(failed_transfer)
        }
    })
}

pub fn handle_successful_cycles_transfer(index: u32, transfer: CompletedCyclesTransfer) {
    let crypto_transfer = CryptocurrencyTransfer::Cycles(CyclesTransfer::Completed(transfer));
    mutate_state(|state| state.data.transactions.update(index, crypto_transfer));
}

pub fn handle_failed_cycles_transfer(index: u32, failed_transfer: FailedCyclesTransfer) {
    mutate_state(|state| {
        state.data.user_cycles_balance.add(failed_transfer.cycles, state.env.now());

        let crypto_transfer = CryptocurrencyTransfer::Cycles(CyclesTransfer::Failed(failed_transfer));
        state.data.transactions.update(index, crypto_transfer);
    });
}
