use types::{Document, HeaderField, HttpResponse};

const CACHE_HEADER_VALUE: &str = "public, max-age=100000000, immutable";

pub fn get_document(requested_document_id: Option<u128>, document: &Option<Document>, path: &str) -> HttpResponse {
    if let Some(document) = document {
        if let Some(requested_document_id) = requested_document_id {
            if requested_document_id == document.id {
                HttpResponse {
                    status_code: 200,
                    headers: vec![
                        HeaderField("Content-Type".to_string(), document.mime_type.to_owned()),
                        HeaderField("Cache-Control".to_string(), CACHE_HEADER_VALUE.to_owned()),
                    ],
                    body: document.data.clone(),
                    streaming_strategy: None,
                }
            } else {
                let location = build_document_location(path, document.id);
                HttpResponse::moved_permanently(&location)
            }
        } else {
            let location = build_document_location(path, document.id);
            HttpResponse::moved_temporarily(&location, Some(3600))
        }
    } else if requested_document_id.is_some() {
        HttpResponse::gone()
    } else {
        HttpResponse::not_found()
    }
}

fn build_document_location(type_name: &str, blob_id: u128) -> String {
    format!("/{type_name}/{blob_id}")
}
