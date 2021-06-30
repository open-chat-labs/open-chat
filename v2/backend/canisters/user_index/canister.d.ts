import type { IDL } from "@dfinity/candid";
import UserIndexService, {
  GetCurrentUserResponse,
  GetCurrentUserRequest,
  UpdateUsernameRequest,
  UpdateUsernameResponse,
  RegisterPhoneNumberRequest,
  RegisterPhoneNumberResponse,
  ConfirmPhoneNumberRequest,
  ConfirmPhoneNumberResponse,
} from "./canister_types";
export {
  UserIndexService,
  GetCurrentUserResponse as ApiGetCurrentUserResponse,
  GetCurrentUserRequest as ApiGetCurrentUserRequest,
  UpdateUsernameRequest as ApiUpdateUsernameRequest,
  UpdateUsernameResponse as ApiUpdateUsernameResponse,
  RegisterPhoneNumberRequest as ApiRegisterPhoneNumberRequest,
  RegisterPhoneNumberResponse as ApiRegisterPhoneNumberResponse,
  ConfirmPhoneNumberRequest as ApiConfirmPhoneNumberRequest,
  ConfirmPhoneNumberResponse as ApiConfirmPhoneNumberResponse,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
