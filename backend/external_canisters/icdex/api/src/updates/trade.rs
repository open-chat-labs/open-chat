use crate::{ICDexOrderType, MakeOrderResponse, OrderPrice};
use candid::Nat;

pub type Args = (
    OrderPrice,
    ICDexOrderType,
    Option<u128>,
    Option<Nat>,
    Option<[u8; 32]>,
    Option<Vec<u8>>,
);

pub type Response = (MakeOrderResponse,);
