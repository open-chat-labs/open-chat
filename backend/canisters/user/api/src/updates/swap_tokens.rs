use candid::CandidType;
use ts_export::ts_export;
use types::{CanisterId, ExchangeId, Milliseconds, TokenInfo};

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Clone, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: TokenInfo,
    pub output_token: TokenInfo,
    pub input_amount: u128,
    pub exchange_args: ExchangeArgs,
    pub min_output_amount: u128,
    pub pin: Option<String>,
}

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Clone, Debug)]
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

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Clone, Debug)]
pub struct ICPSwapArgs {
    pub swap_canister_id: CanisterId,
    pub zero_for_one: bool,
}

pub type SonicArgs = ICPSwapArgs;

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(SuccessResult),
    SwapFailed,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}

#[ts_export(user, swap_tokens)]
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub amount_out: u128,
}
