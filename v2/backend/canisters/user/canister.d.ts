import type { IDL } from "@dfinity/candid";
import UserService, {
  GetChatsRequest,
  GetChatsResponse,
} from "./canister_types";
export {
  UserService,
  GetChatsRequest as ApiGetChatsRequest,
  GetChatsResponse as ApiGetChatsResponse,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
