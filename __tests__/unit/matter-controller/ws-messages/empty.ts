/**
 * A message that contains no relevant data.
 * Typically, this message is generated when there is an error in the command.
 */
export const rawEmptyMessage: string = `{
  "results": [
      {
          "error": "FAILURE"
      }
  ],
  "logs": [
      {
          "module": "TOO",
          "category": "Info",
          "message": "Q29tbWFuZDogb25vZmYgb24g"
      },
      {
          "module": "TOO",
          "category": "Error",
          "message": "SW5pdEFyZ3M6IFdyb25nIGFyZ3VtZW50cyBudW1iZXI6IDAgaW5zdGVhZCBvZiAy"
      },
      {
          "module": "TOO",
          "category": "Error",
          "message": "UnVuIGNvbW1hbmQgZmFpbHVyZTogLi4vLi4vY29ubmVjdGVkaG9tZWlwL2V4YW1wbGVzL2NoaXAtdG9vbC9jb21tYW5kcy9jb21tb24vQ29tbWFuZHMuY3BwOjI3MDogQ0hJUCBFcnJvciAweDAwMDAwMDJGOiBJbnZhbGlkIGFyZ3VtZW50"
      }
  ]
}`;

/**
 * The parsed message we expect from a command that has an error.
 */
export const expectedEmptyParsedMessage = [];
