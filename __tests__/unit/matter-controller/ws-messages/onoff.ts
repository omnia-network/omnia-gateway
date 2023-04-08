/**
 * The raw message we expect from command:
 * `chip-tool onoff on 0x1 0x1`
 */
export const rawOnOffMessage = `{
  "results": [],
  "logs": [
      {
          "module": "TOO",
          "category": "Info",
          "message": "Q29tbWFuZDogb25vZmYgb24gMHgxIDB4MSA="
      },
      {
          "module": "TOO",
          "category": "Info",
          "message": "U2VuZGluZyBjb21tYW5kIHRvIG5vZGUgMHgx"
      },
      {
          "module": "CSM",
          "category": "Debug",
          "message": "RmluZE9yRXN0YWJsaXNoU2Vzc2lvbjogUGVlcklkID0gWzE6MDAwMDAwMDAwMDAwMDAwMV0="
      },
      {
          "module": "CSM",
          "category": "Debug",
          "message": "RmluZE9yRXN0YWJsaXNoU2Vzc2lvbjogTm8gZXhpc3RpbmcgT3BlcmF0aW9uYWxTZXNzaW9uU2V0dXAgaW5zdGFuY2UgZm91bmQ="
      },
      {
          "module": "DIS",
          "category": "Info",
          "message": "Rm91bmQgYW4gZXhpc3Rpbmcgc2VjdXJlIHNlc3Npb24gdG8gWzE6MDAwMDAwMDAwMDAwMDAwMV0h"
      },
      {
          "module": "DIS",
          "category": "Debug",
          "message": "T3BlcmF0aW9uYWxTZXNzaW9uU2V0dXBbMTowMDAwMDAwMDAwMDAwMDAxXTogU3RhdGUgY2hhbmdlIDEgLS0+IDU="
      },
      {
          "module": "TOO",
          "category": "Info",
          "message": "U2VuZGluZyBjbHVzdGVyICgweDAwMDAwMDA2KSBjb21tYW5kICgweDAwMDAwMDAxKSBvbiBlbmRwb2ludCAx"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "SUNSIG1vdmluZyB0byBbQWRkaW5nQ29tbV0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "SUNSIG1vdmluZyB0byBbQWRkZWRDb21tYV0="
      },
      {
          "module": "EM",
          "category": "Info",
          "message": "PDw8IFtFOjE1NjE1aSBTOjU0ODM3IE06NDkyMTIzNTFdIChTKSBNc2cgVFggdG8gMTowMDAwMDAwMDAwMDAwMDAxIFsyN0I2XSAtLS0gVHlwZSAwMDAxOjA4IChJTTpJbnZva2VDb21tYW5kUmVxdWVzdCk="
      },
      {
          "module": "IN",
          "category": "Info",
          "message": "KFMpIFNlbmRpbmcgbXNnIDQ5MjEyMzUxIG9uIHNlY3VyZSBzZXNzaW9uIHdpdGggTFNJRDogNTQ4Mzc="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "SUNSIG1vdmluZyB0byBbQ29tbWFuZFNlbl0="
      },
      {
          "module": "EM",
          "category": "Info",
          "message": "Pj4+IFtFOjE1NjE1aSBTOjU0ODM3IE06MTI2MTA3OTM4IChBY2s6NDkyMTIzNTEpXSAoUykgTXNnIFJYIGZyb20gMTowMDAwMDAwMDAwMDAwMDAxIFsyN0I2XSAtLS0gVHlwZSAwMDAxOjA5IChJTTpJbnZva2VDb21tYW5kUmVzcG9uc2Up"
      },
      {
          "module": "EM",
          "category": "Debug",
          "message": "Rm91bmQgbWF0Y2hpbmcgZXhjaGFuZ2U6IDE1NjE1aSwgRGVsZWdhdGU6IDB4ZmZmZjkwMDU1OTA4"
      },
      {
          "module": "EM",
          "category": "Debug",
          "message": "UnhkIEFjazsgUmVtb3ZpbmcgTWVzc2FnZUNvdW50ZXI6NDkyMTIzNTEgZnJvbSBSZXRyYW5zIFRhYmxlIG9uIGV4Y2hhbmdlIDE1NjE1aQ=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "SUNSIG1vdmluZyB0byBbUmVzcG9uc2VSZV0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "SW52b2tlUmVzcG9uc2VNZXNzYWdlID0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "ew=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CXN1cHByZXNzUmVzcG9uc2UgPSBmYWxzZSwg"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CUludm9rZVJlc3BvbnNlSUJzID0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CVs="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQlJbnZva2VSZXNwb25zZUlCID0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQl7"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJQ29tbWFuZFN0YXR1c0lCID0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJew=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCUNvbW1hbmRQYXRoSUIgPQ=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCXs="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCQlFbmRwb2ludElkID0gMHgxLA=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCQlDbHVzdGVySWQgPSAweDYs"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCQlDb21tYW5kSWQgPSAweDEs"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCX0s"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCQ=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCVN0YXR1c0lCID0="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCXs="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCQlzdGF0dXMgPSAweDAwIChTVUNDRVNTKSw="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCX0s"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJCQ=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJfSw="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQkJ"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQl9LA=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQk="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CV0s"
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CQ=="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "CUludGVyYWN0aW9uTW9kZWxSZXZpc2lvbiA9IDE="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "fSw="
      },
      {
          "module": "DMG",
          "category": "Info",
          "message": "UmVjZWl2ZWQgQ29tbWFuZCBSZXNwb25zZSBTdGF0dXMgZm9yIEVuZHBvaW50PTEgQ2x1c3Rlcj0weDAwMDBfMDAwNiBDb21tYW5kPTB4MDAwMF8wMDAxIFN0YXR1cz0weDA="
      },
      {
          "module": "DMG",
          "category": "Debug",
          "message": "SUNSIG1vdmluZyB0byBbQXdhaXRpbmdEZV0="
      },
      {
          "module": "EM",
          "category": "Info",
          "message": "PDw8IFtFOjE1NjE1aSBTOjU0ODM3IE06NDkyMTIzNTIgKEFjazoxMjYxMDc5MzgpXSAoUykgTXNnIFRYIHRvIDE6MDAwMDAwMDAwMDAwMDAwMSBbMjdCNl0gLS0tIFR5cGUgMDAwMDoxMCAoU2VjdXJlQ2hhbm5lbDpTdGFuZGFsb25lQWNrKQ=="
      },
      {
          "module": "IN",
          "category": "Info",
          "message": "KFMpIFNlbmRpbmcgbXNnIDQ5MjEyMzUyIG9uIHNlY3VyZSBzZXNzaW9uIHdpdGggTFNJRDogNTQ4Mzc="
      },
      {
          "module": "EM",
          "category": "Debug",
          "message": "Rmx1c2hlZCBwZW5kaW5nIGFjayBmb3IgTWVzc2FnZUNvdW50ZXI6MTI2MTA3OTM4IG9uIGV4Y2hhbmdlIDE1NjE1aQ=="
      }
  ]
}`;

/**
 * The parsed message we expect from command:
 * `chip-tool onoff on 0x1 0x1`
 */
export const expectedOnOffParsedMessage = [
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
];
