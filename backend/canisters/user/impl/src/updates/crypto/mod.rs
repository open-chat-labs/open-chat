use crate::read_state;
use crate::updates::crypto::cycles::{start_cycles_transfer, CyclesTransferDetails};
use crate::updates::crypto::icp::send_icp;
use types::{
    CompletedCryptocurrencyTransfer, CompletedICPTransfer, CryptocurrencyTransfer, CyclesTransfer, ICPTransfer, UserId,
};

pub mod cycles;
pub mod icp;

pub async fn process_transfer(
    transfer: CryptocurrencyTransfer,
    recipient: UserId,
) -> Result<CompletedTransferDetails, TransferError> {
    read_state(|state| {
        if !state.is_caller_owner() {
            panic!("Only the owner can transfer cryptocurrency");
        }
    });

    if transfer.recipient() != recipient {
        return Err(TransferError::InvalidRequest(
            "Transfer recipient does not match message recipient".to_string(),
        ));
    }

    match transfer {
        CryptocurrencyTransfer::Cycles(CyclesTransfer::Pending(pending_transfer)) => {
            match start_cycles_transfer(pending_transfer) {
                Ok(completed_transfer) => Ok(CompletedTransferDetails::Cycles(completed_transfer)),
                Err(failed_transfer) => Err(TransferError::TransferFailed(failed_transfer.error_message)),
            }
        }
        CryptocurrencyTransfer::ICP(ICPTransfer::Pending(pending_transfer)) => match send_icp(pending_transfer).await {
            Ok(completed_transfer) => Ok(CompletedTransferDetails::ICP(completed_transfer)),
            Err(failed_transfer) => Err(TransferError::TransferFailed(failed_transfer.error_message)),
        },
        _ => Err(TransferError::InvalidRequest("Can only send pending transfers".to_string())),
    }
}

#[allow(clippy::upper_case_acronyms)]
#[derive(Clone)]
pub enum CompletedTransferDetails {
    Cycles(CyclesTransferDetails),
    ICP(CompletedICPTransfer),
}

impl From<CompletedTransferDetails> for CompletedCryptocurrencyTransfer {
    fn from(t: CompletedTransferDetails) -> Self {
        match t {
            CompletedTransferDetails::Cycles(c) => CompletedCryptocurrencyTransfer::Cycles(c.transfer),
            CompletedTransferDetails::ICP(i) => CompletedCryptocurrencyTransfer::ICP(i),
        }
    }
}

impl From<CompletedTransferDetails> for CryptocurrencyTransfer {
    fn from(t: CompletedTransferDetails) -> Self {
        match t {
            CompletedTransferDetails::Cycles(c) => CryptocurrencyTransfer::Cycles(CyclesTransfer::Completed(c.transfer)),
            CompletedTransferDetails::ICP(i) => CryptocurrencyTransfer::ICP(ICPTransfer::Completed(i)),
        }
    }
}

pub enum TransferError {
    InvalidRequest(String),
    TransferFailed(String),
}
