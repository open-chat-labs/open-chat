use base64::Engine;
use serde::de::DeserializeOwned;
use serde::Serialize;

pub fn from_value<T>(value: &T) -> String
where
    T: Serialize,
{
    let json = serde_json::to_vec(value).unwrap();
    base64::engine::general_purpose::STANDARD.encode(json)
}

pub fn to_value<T: DeserializeOwned>(text: &str) -> Result<T, Box<dyn std::error::Error + Sync + Send>> {
    let json = base64::engine::general_purpose::STANDARD.decode(text)?;
    let result = serde_json::from_slice(&json)?;
    Ok(result)
}
