use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, ExchangeId, Milliseconds, PinNumberWrapper, TokenInfo};

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub input_amount: u128,
    pub exchange_args: ExchangeArgs,
    pub min_output_amount: u128,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ExchangeArgs {
    ICPSwap(ICPSwapArgs),
    Sonic(SonicArgs),
    KongSwap(KongSwapArgs),
}

impl ExchangeArgs {
    pub fn exchange_id(&self) -> ExchangeId {
        match self {
            ExchangeArgs::ICPSwap(_) => ExchangeId::ICPSwap,
            ExchangeArgs::Sonic(_) => ExchangeId::Sonic,
            ExchangeArgs::KongSwap(_) => ExchangeId::KongSwap,
        }
    }

    pub fn swap_canister_id(&self) -> CanisterId {
        match self {
            ExchangeArgs::ICPSwap(a) => a.swap_canister_id,
            ExchangeArgs::Sonic(a) => a.swap_canister_id,
            ExchangeArgs::KongSwap(a) => a.swap_canister_id,
        }
    }
}

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ICPSwapArgs {
    pub swap_canister_id: CanisterId,
    pub zero_for_one: bool,
}

pub type SonicArgs = ICPSwapArgs;
pub type KongSwapArgs = ICPSwapArgs;

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SwapFailed,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
    Error(OCError),
}

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub amount_out: u128,
}
