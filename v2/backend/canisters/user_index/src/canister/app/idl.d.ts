import type { IDL } from "@dfinity/candid";
import UserIndexService, {
  CurrentUserResponse,
  CurrentUserRequest,
  SetUsernameRequest,
  SetUsernameResponse,
  SubmitPhoneNumberRequest,
  SubmitPhoneNumberResponse,
  ConfirmPhoneNumberRequest,
  ConfirmPhoneNumberResponse,
  PhoneNumber,
} from "./types";
export {
  UserIndexService,
  CurrentUserResponse as ApiCurrentUserResponse,
  CurrentUserRequest as ApiCurrentUserRequest,
  SetUsernameRequest as ApiSetUsernameRequest,
  SetUsernameResponse as ApiSetUsernameResponse,
  SubmitPhoneNumberRequest as ApiSubmitPhoneNumberRequest,
  SubmitPhoneNumberResponse as ApiSubmitPhoneNumberResponse,
  ConfirmPhoneNumberRequest as ApiConfirmPhoneNumberRequest,
  ConfirmPhoneNumberResponse as ApiConfirmPhoneNumberResponse,
  PhoneNumber as ApiPhoneNumber,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
