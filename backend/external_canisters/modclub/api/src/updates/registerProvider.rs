use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
#[expect(non_snake_case)]
pub struct Image {
    pub data: Vec<u8>,
    pub imageType: String,
}

pub type Args = (String, String, Option<Image>);
pub type Response = (String,);
