use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, ExchangeId, PinNumberWrapper, TokenInfo};

#[ts_export(user, swap_tokens)]
#[derive(Serialize, Deserialize, Clone, Debug)]
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
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum ExchangeArgs {
    ICPSwap(ICPSwapArgs),
    Taco(TacoArgs),
    Sonic(SonicArgs),
    KongSwap(KongSwapArgs),
}

impl ExchangeArgs {
    pub fn exchange_id(&self) -> ExchangeId {
        match self {
            ExchangeArgs::ICPSwap(_) => ExchangeId::ICPSwap,
            ExchangeArgs::Taco(_) => ExchangeId::Taco,
            ExchangeArgs::Sonic(_) => ExchangeId::Sonic,
            ExchangeArgs::KongSwap(_) => ExchangeId::KongSwap,
        }
    }

    pub fn swap_canister_id(&self) -> CanisterId {
        match self {
            ExchangeArgs::ICPSwap(a) => a.swap_canister_id,
            ExchangeArgs::Taco(a) => a.swap_canister_id,
            ExchangeArgs::Sonic(a) => a.swap_canister_id,
            ExchangeArgs::KongSwap(a) => a.swap_canister_id,
        }
    }
}

#[ts_export(user, swap_tokens)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExchangeSwapArgs {
    pub swap_canister_id: CanisterId,
    pub zero_for_one: bool,
}

pub type ICPSwapArgs = ExchangeSwapArgs;
pub type SonicArgs = ExchangeSwapArgs;
pub type KongSwapArgs = ExchangeSwapArgs;

#[ts_export(user, swap_tokens)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TacoArgs {
    /// The TACO exchange canister that handles swap_multi_hop / swap_split_routes
    /// (production: qioex-5iaaa-aaaan-q52ba-cai).
    pub swap_canister_id: CanisterId,
    /// The exchange-treasury canister that holds deposited tokens — this is the
    /// account TACO's `checkReceive` validates the user's ICRC1 transfer against
    /// (production: qbnpl-laaaa-aaaan-q52aq-cai). Distinct from swap_canister_id.
    pub treasury_canister_id: CanisterId,
}

#[ts_export(user, swap_tokens)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(user, swap_tokens)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub amount_out: u128,
}
