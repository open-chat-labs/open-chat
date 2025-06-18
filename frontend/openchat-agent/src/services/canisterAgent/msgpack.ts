import {
    Certificate,
    CertifiedRejectErrorCode,
    HttpAgent,
    type Identity,
    isV2ResponseBody,
    isV3ResponseBody,
    lookupResultToBuffer,
    polling,
    RejectError,
    UncertifiedRejectErrorCode,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { Static, TSchema } from "@sinclair/typebox";
import { deserializeFromMsgPack, serializeToMsgPack } from "../../utils/msgpack";
import { typeboxValidate } from "../../utils/typebox";
import { toCanisterResponseError } from "../error";
import { CanisterAgent } from "./base";
import { utf8ToBytes } from "@noble/hashes/utils";

export abstract class MsgpackCanisterAgent extends CanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string, canisterName: string) {
        super(identity, agent, canisterId, canisterName);
    }

    protected async executeMsgpackQuery<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const start = performance.now();
        let isError = false;
        try {
            const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

            return await this.executeQuery(
                () =>
                    this.agent.query(this.canisterId, {
                        methodName: methodName + "_msgpack",
                        arg: payload,
                    }),
                (resp) => {
                    if (resp.status === "replied") {
                        return Promise.resolve(
                            MsgpackCanisterAgent.processMsgpackResponse(
                                resp.reply.arg,
                                mapper,
                                responseValidator,
                            ),
                        );
                    } else {
                        const uncertifiedRejectErrorCode = new UncertifiedRejectErrorCode(
                            resp.requestId,
                            resp.reject_code,
                            resp.reject_message,
                            resp.error_code,
                            resp.signatures,
                        );
                        uncertifiedRejectErrorCode.callContext = {
                            canisterId: Principal.fromText(this.canisterId),
                            methodName,
                            httpDetails: resp.httpDetails,
                        };
                        throw RejectError.fromCode(uncertifiedRejectErrorCode);
                    }
                },
                args,
            );
        } catch (err) {
            isError = true;
            throw err;
        } finally {
            this.writeTrace(methodName, false, performance.now() - start, isError);
        }
    }

    protected async executeMsgpackUpdate<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
        onRequestAccepted?: () => void,
    ): Promise<Out> {
        const start = performance.now();
        let isError = false;
        try {
            const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

            const { requestId, response } = await this.agent.call(this.canisterId, {
                methodName: methodName + "_msgpack",
                arg: payload,
                callSync: onRequestAccepted === undefined,
            });
            const canisterId = Principal.fromText(this.canisterId);

            if (isV3ResponseBody(response.body)) {
                // const certTime = this.agent.replicaTime;
                const certificate = await Certificate.create({
                    certificate: response.body.certificate,
                    rootKey: this.agent.rootKey!,
                    canisterId: Principal.from(canisterId),
                    blsVerify: undefined,
                });
                const path = [utf8ToBytes('request_status'), requestId];
                const status = new TextDecoder().decode(
                    lookupResultToBuffer(certificate.lookup_path([...path, 'status'])),
                );

                switch (status) {
                    case "replied": {
                        const reply = lookupResultToBuffer(certificate.lookup_path([...path, "reply"]));
                        if (reply) {
                            return Promise.resolve(
                                MsgpackCanisterAgent.processMsgpackResponse(
                                    reply,
                                    mapper,
                                    responseValidator,
                                ),
                            );
                        }
                        break;
                    }
                    case "rejected": {
                        // Find rejection details in the certificate
                        const rejectCode = new Uint8Array(
                            lookupResultToBuffer(certificate.lookup_path([...path, 'reject_code']))!,
                        )[0];
                        const rejectMessage = new TextDecoder().decode(
                            lookupResultToBuffer(certificate.lookup_path([...path, 'reject_message']))!,
                        );

                        const error_code_buf = lookupResultToBuffer(
                            certificate.lookup_path([...path, 'error_code']),
                        );
                        const error_code = error_code_buf
                            ? new TextDecoder().decode(error_code_buf)
                            : undefined;

                        const certifiedRejectErrorCode = new CertifiedRejectErrorCode(
                            requestId,
                            rejectCode,
                            rejectMessage,
                            error_code,
                        );
                        certifiedRejectErrorCode.callContext = {
                            canisterId,
                            methodName,
                            httpDetails: response,
                        };
                        throw RejectError.fromCode(certifiedRejectErrorCode);
                    }
                }
            } else if (isV2ResponseBody(response.body)) {
                // handle v2 response errors by throwing an UpdateCallRejectedError object
                const { reject_code, reject_message, error_code } = response.body;
                const certifiedRejectErrorCode = new CertifiedRejectErrorCode(
                    requestId,
                    reject_code,
                    reject_message,
                    error_code,
                );
                certifiedRejectErrorCode.callContext = {
                    canisterId,
                    methodName,
                    httpDetails: response,
                };
                throw RejectError.fromCode(certifiedRejectErrorCode);
            }

            // Fall back to polling if we receive an Accepted response code
            if (response.status === 202) {
                if (onRequestAccepted !== undefined) {
                    onRequestAccepted();
                }

                const { reply } = await polling.pollForResponse(
                    this.agent,
                    canisterId,
                    requestId,
                );
                return Promise.resolve(
                    MsgpackCanisterAgent.processMsgpackResponse(reply, mapper, responseValidator),
                );
            } else {
                throw new Error(`Failed to submit call to IC. CanisterId: ${canisterId}. MethodName: ${methodName}. Response: ${response}`);
            }
        } catch (err) {
            isError = true;
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        } finally {
            this.writeTrace(methodName, true, performance.now() - start, isError);
        }
    }

    private static prepareMsgpackArgs<T extends TSchema>(
        value: unknown,
        validator: T,
    ): Uint8Array {
        const validated = typeboxValidate(value, validator);
        return serializeToMsgPack(validated);
    }

    private static processMsgpackResponse<Resp extends TSchema, Out>(
        responseBytes: Uint8Array,
        mapper: (from: Static<Resp>) => Out,
        validator: Resp,
    ): Out {
        const response = deserializeFromMsgPack(new Uint8Array(responseBytes));
        const validated = typeboxValidate(response, validator);
        return mapper(validated);
    }
}
