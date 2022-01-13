use ic_cdk::api::call::RejectionCode;

#[derive(Debug)]
pub struct Error {
    pub code: RejectionCode,
    pub msg: String,
}
