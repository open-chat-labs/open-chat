use crate::model::sessions::SessionStatus;
use crate::updates::start_verification::{max_frame_bytes, max_total_bytes};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use personhood_verifier_canister::upload_frame::{Response::*, *};

const JPEG_MAGIC: [u8; 2] = [0xFF, 0xD8];

#[update(msgpack = true)]
#[trace]
fn upload_frame(args: Args) -> Response {
    mutate_state(|state| upload_frame_impl(args, state))
}

fn upload_frame_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let test_mode = state.data.test_mode;

    let Some(session) = state.data.sessions.get_mut(args.session_id) else {
        return SessionNotFound;
    };
    // Sessions are bound to the caller principal; don't reveal others' sessions
    if session.principal != caller || !matches!(session.status, SessionStatus::Open) {
        return SessionNotFound;
    }
    if session.deadline <= now {
        return SessionExpired;
    }
    let index = args.challenge_index as usize;
    if index >= session.challenge.len() {
        return InvalidChallengeIndex;
    }
    let frame_bytes = args.image.len() as u32;
    if frame_bytes > max_frame_bytes() {
        return FrameTooLarge;
    }
    let existing_bytes = session.frames[index].as_ref().map_or(0, |f| f.len() as u32);
    if session.total_bytes.saturating_sub(existing_bytes) + frame_bytes > max_total_bytes() {
        return TotalBytesExceeded;
    }
    // The real pipeline fully decodes frames; in test mode the stub engine
    // reads a marker byte instead of JPEG data
    if !test_mode {
        if args.image.get(..2) != Some(&JPEG_MAGIC) {
            return InvalidImage;
        }
        // Reject oversized images before they enter the processing queue: a
        // small, highly-compressible file can expand to hundreds of megapixels
        // and blow the per-message instruction budget (decode also caps this,
        // but rejecting here keeps the poison frame out of the queue entirely)
        match face_pipeline::jpeg_dimensions(&args.image) {
            Some((w, h)) if w as usize <= face_pipeline::MAX_DECODE_DIM && h as usize <= face_pipeline::MAX_DECODE_DIM => {}
            _ => return InvalidImage,
        }
    }

    session.total_bytes = session.total_bytes.saturating_sub(existing_bytes) + frame_bytes;
    session.frames[index] = Some(args.image);
    Success
}
