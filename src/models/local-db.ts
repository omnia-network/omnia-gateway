export type LocalDb = {
  commissionedDevices: {
    [key: string]: {
      matterNodeId: number;
      matterData: {
        vendorId: number;
        productId: number;

        pairingCode: string;
        pairingResult: any;
      };
    };
  };
};
