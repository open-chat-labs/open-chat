use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, ExchangeId, Milliseconds, TokenInfo};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub input_amount: u128,
    pub exchange_args: ExchangeArgs,
    pub min_output_amount: u128,
    pub pin: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ExchangeArgs {
    ICPSwap(ICPSwapArgs),
    Sonic(SonicArgs),
}

impl ExchangeArgs {
    pub fn exchange_id(&self) -> ExchangeId {
        match self {
            ExchangeArgs::ICPSwap(_) => ExchangeId::ICPSwap,
            ExchangeArgs::Sonic(_) => ExchangeId::Sonic,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ICPSwapArgs {
    pub swap_canister_id: CanisterId,
    pub zero_for_one: bool,
}

pub type SonicArgs = ICPSwapArgs;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SwapFailed,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub amount_out: u128,
}
