import type {
    UpdateProposalsGroupResponse,
} from "openchat-shared";
import type {
    ApiUpdateProposalsGroupResponse,
} from "./candid/idl";
import { UnsupportedValueError } from "openchat-shared";

export function updateProposalsGroupResponse(candid: ApiUpdateProposalsGroupResponse): UpdateProposalsGroupResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotFound" in candid) {
        return "not_found";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorized";
    }
    if ("NameTooShort" in candid) {
        return "name_too_short";
    }
    if ("NameTooLong" in candid) {
        return "name_too_long";
    }
    if ("NameTaken" in candid) {
        return "name_taken";
    }
    if ("DescriptionTooLong" in candid) {
        return "desc_too_long";
    }
    if ("AvatarTooBig" in candid) {
        return "avatar_too_big";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    throw new UnsupportedValueError("Unexpected ApiUpdateProposalsGroupResponse type received", candid);
}