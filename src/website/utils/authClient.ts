import { AuthClient } from "@dfinity/auth-client";
import { Option } from "../domain/model/common";

let authClient: Option<AuthClient>;

export const init = async () => {
    if (!authClient) {
        authClient = await AuthClient.create();
    }
}

const getAuthClient = () : AuthClient => authClient!;

export default getAuthClient;
