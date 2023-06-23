// This file is auto-generated by the generate-omnia-backend-types.sh script. Do not edit it manually.

export const idlFactory = ({ IDL }) => {
  const EnvironmentCreationInput = IDL.Record({ 'env_name' : IDL.Text });
  const EnvironmentCreationResult = IDL.Record({
    'env_uid' : IDL.Text,
    'env_name' : IDL.Text,
  });
  const Result = IDL.Variant({
    'Ok' : EnvironmentCreationResult,
    'Err' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Vec(IDL.Nat8), 'Err' : IDL.Text });
  const Tokens = IDL.Record({ 'e8s' : IDL.Nat64 });
  const PairingInfo = IDL.Record({ 'payload' : IDL.Text });
  const UpdateValue = IDL.Record({
    'info' : PairingInfo,
    'command' : IDL.Text,
    'virtual_persona_principal_id' : IDL.Text,
    'virtual_persona_ip' : IDL.Text,
  });
  const InitializedGatewayValue = IDL.Record({
    'principal_id' : IDL.Text,
    'proxied_gateway_uid' : IDL.Opt(IDL.Text),
  });
  const Result_2 = IDL.Variant({
    'Ok' : IDL.Vec(InitializedGatewayValue),
    'Err' : IDL.Text,
  });
  const VirtualPersonaValue = IDL.Record({
    'manager_env_uid' : IDL.Opt(IDL.Text),
    'user_env_uid' : IDL.Opt(IDL.Text),
    'virtual_persona_principal_id' : IDL.Text,
    'virtual_persona_ip' : IDL.Text,
  });
  const Result_3 = IDL.Variant({
    'Ok' : VirtualPersonaValue,
    'Err' : IDL.Text,
  });
  const Result_4 = IDL.Variant({ 'Ok' : IDL.Vec(IDL.Text), 'Err' : IDL.Text });
  const RegisteredGatewayValue = IDL.Record({
    'gateway_name' : IDL.Text,
    'gateway_ip' : IDL.Text,
    'env_uid' : IDL.Text,
    'gat_registered_device_uids' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Null)),
    'gateway_url' : IDL.Text,
    'proxied_gateway_uid' : IDL.Opt(IDL.Text),
  });
  const Result_5 = IDL.Variant({
    'Ok' : IDL.Vec(RegisteredGatewayValue),
    'Err' : IDL.Text,
  });
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'upgrade' : IDL.Opt(IDL.Bool),
  });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'upgrade' : IDL.Opt(IDL.Bool),
    'streaming_strategy' : IDL.Opt(IDL.Text),
    'status_code' : IDL.Nat16,
  });
  const Result_6 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const Result_7 = IDL.Variant({ 'Ok' : UpdateValue, 'Err' : IDL.Text });
  const DeviceAffordances = IDL.Record({
    'properties' : IDL.Vec(IDL.Text),
    'actions' : IDL.Vec(IDL.Text),
  });
  const RegisteredDeviceIndex = IDL.Record({ 'device_uid' : IDL.Text });
  const RegisteredDeviceValue = IDL.Record({
    'required_headers' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'env_uid' : IDL.Text,
    'device_url' : IDL.Text,
    'gateway_principal_id' : IDL.Text,
  });
  const Result_8 = IDL.Variant({
    'Ok' : IDL.Tuple(RegisteredDeviceIndex, RegisteredDeviceValue),
    'Err' : IDL.Text,
  });
  const GatewayRegistrationInput = IDL.Record({
    'gateway_name' : IDL.Text,
    'env_uid' : IDL.Text,
  });
  const Result_9 = IDL.Variant({
    'Ok' : RegisteredGatewayValue,
    'Err' : IDL.Text,
  });
  const UniqueAccessKey = IDL.Record({ 'key' : IDL.Text, 'nonce' : IDL.Nat });
  const SignedRequest = IDL.Record({
    'requester_canister_id' : IDL.Principal,
    'unique_access_key' : UniqueAccessKey,
    'signature_hex' : IDL.Text,
  });
  const RejectedAccessKeyReason = IDL.Variant({
    'InvalidNonce' : IDL.Null,
    'RequestsLimitReached' : IDL.Null,
    'InvalidAccessKey' : IDL.Null,
    'InvalidSignature' : IDL.Null,
    'NonceAlreadyUsed' : IDL.Null,
    'SignatureVerificationError' : IDL.Text,
  });
  const RejectedAccessKey = IDL.Record({
    'key' : IDL.Text,
    'reason' : RejectedAccessKeyReason,
  });
  const Result_10 = IDL.Variant({
    'Ok' : IDL.Vec(RejectedAccessKey),
    'Err' : IDL.Text,
  });
  const EnvironmentInfo = IDL.Record({ 'env_uid' : IDL.Text });
  const Result_11 = IDL.Variant({ 'Ok' : EnvironmentInfo, 'Err' : IDL.Text });
  return IDL.Service({
    'createEnvironment' : IDL.Func([EnvironmentCreationInput], [Result], []),
    'executeRdfDbQuery' : IDL.Func([IDL.Text], [Result_1], ['query']),
    'executeRdfDbQueryAsUpdate' : IDL.Func([IDL.Text], [Result_1], []),
    'getAccessKeyPrice' : IDL.Func([], [Tokens], ['query']),
    'getAccessKeyPriceAsUpdate' : IDL.Func([], [Tokens], []),
    'getGatewayUpdates' : IDL.Func([], [IDL.Opt(UpdateValue)], []),
    'getInitializedGateways' : IDL.Func([IDL.Text], [Result_2], []),
    'getProfile' : IDL.Func([IDL.Text], [Result_3], []),
    'getRegisteredDevices' : IDL.Func([], [Result_4], []),
    'getRegisteredGateways' : IDL.Func([IDL.Text], [Result_5], []),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'http_request_update' : IDL.Func([HttpRequest], [HttpResponse], []),
    'initGateway' : IDL.Func([IDL.Text], [Result_6], []),
    'obtainAccessKey' : IDL.Func([IDL.Nat64], [Result_6], []),
    'pairNewDevice' : IDL.Func([IDL.Text, IDL.Text, IDL.Text], [Result_7], []),
    'registerDevice' : IDL.Func([IDL.Text, DeviceAffordances], [Result_8], []),
    'registerGateway' : IDL.Func(
        [IDL.Text, GatewayRegistrationInput],
        [Result_9],
        [],
      ),
    'reportSignedRequests' : IDL.Func(
        [IDL.Vec(SignedRequest)],
        [Result_10],
        [],
      ),
    'resetEnvironment' : IDL.Func([IDL.Text], [Result_11], []),
    'setEnvironment' : IDL.Func([IDL.Text], [Result_11], []),
  });
};
export const init = ({ IDL }) => { return [IDL.Text, IDL.Text, IDL.Text]; };
