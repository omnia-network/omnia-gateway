// This file is auto-generated by the generate-omnia-backend-types.sh script. Do not edit it manually.

import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export interface AccessKeyValue {
  'key' : string,
  'transaction_hash' : Uint8Array | number[],
  'counter' : bigint,
  'owner' : Principal,
  'used_nonces' : Array<bigint>,
}
export interface DeviceAffordances {
  'properties' : Array<string>,
  'actions' : Array<string>,
}
export interface EnvironmentCreationInput { 'env_name' : string }
export interface EnvironmentCreationResult {
  'env_uid' : string,
  'env_name' : string,
}
export interface EnvironmentInfo { 'env_uid' : string }
export interface GatewayRegistrationInput {
  'gateway_name' : string,
  'env_uid' : string,
}
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : [] | [Uint8Array | number[]],
  'headers' : Array<[string, string]>,
  'upgrade' : [] | [boolean],
}
export interface HttpResponse {
  'body' : Uint8Array | number[],
  'headers' : Array<[string, string]>,
  'upgrade' : [] | [boolean],
  'streaming_strategy' : [] | [string],
  'status_code' : number,
}
export interface InitializedGatewayValue {
  'principal_id' : string,
  'proxied_gateway_uid' : [] | [string],
}
export interface PairingInfo { 'payload' : string }
export interface RegisteredDeviceIndex { 'device_uid' : string }
export interface RegisteredDeviceValue {
  'required_headers' : [] | [Array<[string, string]>],
  'env_uid' : string,
  'device_url' : string,
  'gateway_principal_id' : string,
}
export interface RegisteredGatewayValue {
  'gateway_name' : string,
  'gateway_ip' : string,
  'env_uid' : string,
  'gat_registered_device_uids' : Array<[string, null]>,
  'gateway_url' : string,
  'proxied_gateway_uid' : [] | [string],
}
export type Result = { 'Ok' : EnvironmentCreationResult } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : Uint8Array | number[] } |
  { 'Err' : string };
export type Result_10 = { 'Ok' : AccessKeyValue } |
  { 'Err' : string };
export type Result_11 = { 'Ok' : EnvironmentInfo } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : Array<InitializedGatewayValue> } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : VirtualPersonaValue } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : Array<string> } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : Array<RegisteredGatewayValue> } |
  { 'Err' : string };
export type Result_6 = { 'Ok' : string } |
  { 'Err' : string };
export type Result_7 = { 'Ok' : UpdateValue } |
  { 'Err' : string };
export type Result_8 = {
    'Ok' : [RegisteredDeviceIndex, RegisteredDeviceValue]
  } |
  { 'Err' : string };
export type Result_9 = { 'Ok' : RegisteredGatewayValue } |
  { 'Err' : string };
export interface SignedRequest {
  'requester_canister_id' : Principal,
  'unique_access_key' : UniqueAccessKey,
  'signature_hex' : string,
}
export interface Tokens { 'e8s' : bigint }
export interface UniqueAccessKey { 'key' : string, 'nonce' : bigint }
export interface UpdateValue {
  'info' : PairingInfo,
  'command' : string,
  'virtual_persona_principal_id' : string,
  'virtual_persona_ip' : string,
}
export interface VirtualPersonaValue {
  'manager_env_uid' : [] | [string],
  'user_env_uid' : [] | [string],
  'virtual_persona_principal_id' : string,
  'virtual_persona_ip' : string,
}
export interface _SERVICE {
  'createEnvironment' : ActorMethod<[EnvironmentCreationInput], Result>,
  'executeRdfDbQuery' : ActorMethod<[string], Result_1>,
  'executeRdfDbQueryAsUpdate' : ActorMethod<[string], Result_1>,
  'getAccessKeyPrice' : ActorMethod<[], Tokens>,
  'getAccessKeyPriceAsUpdate' : ActorMethod<[], Tokens>,
  'getGatewayUpdates' : ActorMethod<[], [] | [UpdateValue]>,
  'getInitializedGateways' : ActorMethod<[string], Result_2>,
  'getProfile' : ActorMethod<[string], Result_3>,
  'getRegisteredDevices' : ActorMethod<[], Result_4>,
  'getRegisteredGateways' : ActorMethod<[string], Result_5>,
  'http_request' : ActorMethod<[HttpRequest], HttpResponse>,
  'http_request_update' : ActorMethod<[HttpRequest], HttpResponse>,
  'initGateway' : ActorMethod<[string], Result_6>,
  'obtainAccessKey' : ActorMethod<[bigint], Result_6>,
  'pairNewDevice' : ActorMethod<[string, string, string], Result_7>,
  'registerDevice' : ActorMethod<[string, DeviceAffordances], Result_8>,
  'registerGateway' : ActorMethod<[string, GatewayRegistrationInput], Result_9>,
  'reportSignedRequest' : ActorMethod<[SignedRequest], Result_10>,
  'resetEnvironment' : ActorMethod<[string], Result_11>,
  'setEnvironment' : ActorMethod<[string], Result_11>,
}
