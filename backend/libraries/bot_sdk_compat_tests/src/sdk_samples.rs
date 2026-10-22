use crate::variants::every;
use candid::Principal;
use num_traits::Bounded;
use oc_bots_sdk::types::{
    AudioContent, BlobReference, CustomContent, FileContent, GiphyContent, GiphyImageVariant, ImageContent,
    MessageContentInitial, PollConfig, TextContent, ThumbnailData, VideoContent,
};

/// One value of every kind of content a bot can send, with every `Option` filled in if `filled`,
/// else with none. Each integer is its type's largest value, so that a field OpenChat narrows fails
/// to decode.
pub fn message_contents_initial(filled: bool) -> Vec<MessageContentInitial> {
    let caption = || filled.then(|| "Caption".to_string());
    let blob_reference = || {
        filled.then(|| BlobReference {
            canister_id: Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 8, 1, 1]),
            blob_id: max(),
        })
    };

    every(vec![
        MessageContentInitial::Text(TextContent {
            text: "Hello".to_string(),
        }),
        MessageContentInitial::Image(ImageContent {
            width: max(),
            height: max(),
            thumbnail_data: thumbnail(),
            caption: caption(),
            mime_type: "image/png".to_string(),
            blob_reference: blob_reference(),
        }),
        MessageContentInitial::Video(VideoContent {
            width: max(),
            height: max(),
            thumbnail_data: thumbnail(),
            caption: caption(),
            mime_type: "video/mp4".to_string(),
            image_blob_reference: blob_reference(),
            video_blob_reference: blob_reference(),
        }),
        MessageContentInitial::Audio(AudioContent {
            caption: caption(),
            mime_type: "audio/mpeg".to_string(),
            blob_reference: blob_reference(),
            duration_ms: filled.then(max),
            samples: filled.then(|| vec![0, 128, 255]),
        }),
        MessageContentInitial::File(FileContent {
            name: "file.pdf".to_string(),
            caption: caption(),
            mime_type: "application/pdf".to_string(),
            file_size: max(),
            blob_reference: blob_reference(),
        }),
        MessageContentInitial::Poll(
            PollConfig {
                text: filled.then(|| "Question".to_string()),
                options: vec!["Yes".to_string(), "No".to_string()],
                end_date: filled.then(max),
                anonymous: false,
                show_votes_before_end_date: true,
                allow_multiple_votes_per_user: false,
                allow_user_to_change_vote: true,
            }
            .into(),
        ),
        MessageContentInitial::Giphy(GiphyContent {
            caption: caption(),
            title: "Giphy".to_string(),
            desktop: giphy_image_variant(),
            mobile: giphy_image_variant(),
        }),
        MessageContentInitial::Custom(CustomContent {
            kind: "custom".to_string(),
            data: vec![1, 2, 3],
        }),
    ])
}

fn giphy_image_variant() -> GiphyImageVariant {
    GiphyImageVariant {
        width: max(),
        height: max(),
        url: "https://giphy.com/1".to_string(),
        mime_type: "image/gif".to_string(),
    }
}

fn thumbnail() -> ThumbnailData {
    ThumbnailData("data:image/png;base64,AAAA".to_string())
}

fn max<T: Bounded>() -> T {
    T::max_value()
}
