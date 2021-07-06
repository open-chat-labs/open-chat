import type { IDL } from "@dfinity/candid";
import UserIndexService, {
  CurrentUserResponse,
  CurrentUserArgs,
  SetUsernameArgs,
  SetUsernameResponse,
  SubmitPhoneNumberArgs,
  SubmitPhoneNumberResponse,
  ConfirmPhoneNumberArgs,
  ConfirmPhoneNumberResponse,
  PhoneNumber,
  ResendCodeResponse,
} from "./types";
export {
  UserIndexService,
  CurrentUserResponse as ApiCurrentUserResponse,
  CurrentUserArgs as ApiCurrentUserArgs,
  SetUsernameArgs as ApiSetUsernameArgs,
  SetUsernameResponse as ApiSetUsernameResponse,
  SubmitPhoneNumberArgs as ApiSubmitPhoneNumberArgs,
  SubmitPhoneNumberResponse as ApiSubmitPhoneNumberResponse,
  ConfirmPhoneNumberArgs as ApiConfirmPhoneNumberArgs,
  ConfirmPhoneNumberResponse as ApiConfirmPhoneNumberResponse,
  PhoneNumber as ApiPhoneNumber,
  ResendCodeResponse as ApiResendCodeResponse,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
