use canister_api_macros::proposal_validation;
use proposal_validation_canister::*;

proposal_validation!(infinity_swap, burn);
proposal_validation!(infinity_swap, mint);
proposal_validation!(infinity_swap, receive_tokens);
proposal_validation!(infinity_swap, refund_transfer);
