import { resultParser } from "../../src/matter-controller/parser";

describe("Matter Controller: result parser", () => {
  it("should parse the result without errors", async () => {
    const rawData = `ICR moving to [AddingComm]
ICR moving to [AddedComma]
ICR moving to [CommandSen]
ICR moving to [ResponseRe]
InvokeResponseMessage =
{
        suppressResponse = false, 
        InvokeResponseIBs =
        [
                InvokeResponseIB =
                {
                        CommandStatusIB =
                        {
                                CommandPathIB =
                                {
                                        EndpointId = 0x1,
                                        ClusterId = 0x6,
                                        CommandId = 0x1,
                                },

                                StatusIB =
                                {
                                        status = 0x00 (SUCCESS),
                                },
    
                        },
    
                },
    
        ],
    
        InteractionModelRevision = 1
},
Received Command Response Status for Endpoint=1 Cluster=0x0000_0006 Command=0x0000_0001 Status=0x0
ICR moving to [AwaitingDe]`;

    const parsedResult = resultParser(rawData);

    console.log(JSON.stringify(parsedResult, null, 2));

    expect(parsedResult).toEqual([
      {
        InvokeResponseMessage: {
          suppressResponse: false,
          InvokeResponseIBs: [
            {
              InvokeResponseIB: {
                CommandStatusIB: {
                  CommandPathIB: {
                    EndpointId: "0x1",
                    ClusterId: "0x6",
                    CommandId: "0x1",
                  },
                  StatusIB: {
                    status: "0x00",
                  },
                },
              },
            },
          ],
          InteractionModelRevision: 1,
        },
      },
    ]);
  });
});
