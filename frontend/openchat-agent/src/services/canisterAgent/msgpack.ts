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
} from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import type { Static, TSchema } from "@sinclair/typebox";
import { deserializeFromMsgPack, serializeToMsgPack } from "../../utils/msgpack";
import { typeboxValidate } from "../../utils/typebox";
import { toCanisterResponseError } from "../error";
import { CanisterAgent } from "./base";
import { utf8ToBytes } from "@noble/hashes/utils";

abstract class MsgpackCanisterAgent extends CanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterName: string) {
        super(identity, agent, canisterName);
    }

    protected async executeMsgpackQuery<In extends TSchema, Resp extends TSchema, Out>(
        canisterId: string,
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>, timestamp: bigint) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const start = performance.now();
        let isError = false;
        try {
            const canisterIdPrincipal = Principal.fromText(canisterId);
            const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

            return await this.executeQuery(
                () =>
                    this.agent.query(canisterIdPrincipal, {
                        methodName: methodName + "_msgpack",
                        arg: payload,
                    }),
                (resp) => {
                    if (resp.status === "replied") {
                        const sigTimestamp = resp.signatures?.[0]?.timestamp;
                        const timestampMs = sigTimestamp
                            ? BigInt(sigTimestamp) / BigInt(1000000)
                            : BigInt(0);

                        return Promise.resolve(
                            mapper(
                                MsgpackCanisterAgent.deserializeResponse(
                                    resp.reply.arg,
                                    responseValidator,
                                ),
                                timestampMs,
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
                            canisterId: canisterIdPrincipal,
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
        canisterId: string,
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
            const canisterIdPrincipal = Principal.fromText(canisterId);
            const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

            const { requestId, response } = await this.agent.call(canisterIdPrincipal, {
                methodName: methodName + "_msgpack",
                arg: payload,
                callSync: onRequestAccepted === undefined,
            });

            if (isV3ResponseBody(response.body)) {
                // const certTime = this.agent.replicaTime;
                const certificate = await Certificate.create({
                    certificate: response.body.certificate,
                    rootKey: this.agent.rootKey!,
                    canisterId: canisterIdPrincipal,
                    blsVerify: undefined,
                });
                const path = [utf8ToBytes("request_status"), requestId];
                const status = new TextDecoder().decode(
                    lookupResultToBuffer(certificate.lookup_path([...path, "status"])),
                );

                switch (status) {
                    case "replied": {
                        const reply = lookupResultToBuffer(
                            certificate.lookup_path([...path, "reply"]),
                        );
                        if (reply) {
                            return Promise.resolve(
                                mapper(
                                    MsgpackCanisterAgent.deserializeResponse(
                                        reply,
                                        responseValidator,
                                    ),
                                ),
                            );
                        }
                        break;
                    }
                    case "rejected": {
                        // Find rejection details in the certificate
                        const rejectCode = new Uint8Array(
                            lookupResultToBuffer(
                                certificate.lookup_path([...path, "reject_code"]),
                            )!,
                        )[0];
                        const rejectMessage = new TextDecoder().decode(
                            lookupResultToBuffer(
                                certificate.lookup_path([...path, "reject_message"]),
                            )!,
                        );

                        const error_code_buf = lookupResultToBuffer(
                            certificate.lookup_path([...path, "error_code"]),
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
                            canisterId: canisterIdPrincipal,
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
                    canisterId: canisterIdPrincipal,
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

                const { reply } = await polling.pollForResponse(this.agent, canisterIdPrincipal, requestId);
                return Promise.resolve(
                    mapper(MsgpackCanisterAgent.deserializeResponse(reply, responseValidator)),
                );
            } else {
                throw new Error(
                    `Failed to submit call to IC. CanisterId: ${canisterId}. MethodName: ${methodName}. Response: ${response}`,
                );
            }
        } catch (err) {
            isError = true;
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        } finally {
            this.writeTrace(methodName, true, performance.now() - start, isError);
        }
    }

    private static prepareMsgpackArgs<T extends TSchema>(value: unknown, validator: T): Uint8Array {
        const validated = typeboxValidate(value, validator);
        return serializeToMsgPack(validated);
    }

    private static deserializeResponse<Resp extends TSchema>(
        responseBytes: ArrayBuffer,
        validator: Resp,
    ): Static<Resp> {
        const response = deserializeFromMsgPack(new Uint8Array(responseBytes));
        return typeboxValidate(response, validator);
    }
}

export abstract class SingleCanisterMsgpackAgent extends MsgpackCanisterAgent {
    protected readonly canisterId: string;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string, canisterName: string) {
        super(identity, agent, canisterName);

        this.canisterId = canisterId;
    }

    protected query<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>, timestamp: bigint) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        return this.executeMsgpackQuery(this.canisterId, methodName, args, mapper, requestValidator, responseValidator);
    }

    protected async update<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
        onRequestAccepted?: () => void,
    ): Promise<Out> {
        return this.executeMsgpackUpdate(this.canisterId, methodName, args, mapper, requestValidator, responseValidator, onRequestAccepted);
    }
}

export abstract class MultiCanisterMsgpackAgent extends MsgpackCanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterName: string) {
        super(identity, agent, canisterName);
    }

    protected query<In extends TSchema, Resp extends TSchema, Out>(
        canisterId: string,
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>, timestamp: bigint) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        return this.executeMsgpackQuery(canisterId, methodName, args, mapper, requestValidator, responseValidator);
    }

    protected async update<In extends TSchema, Resp extends TSchema, Out>(
        canisterId: string,
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
        onRequestAccepted?: () => void,
    ): Promise<Out> {
        return this.executeMsgpackUpdate(canisterId, methodName, args, mapper, requestValidator, responseValidator, onRequestAccepted);
    }
}

