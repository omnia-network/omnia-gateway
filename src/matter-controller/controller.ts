import { exec } from "child_process";
import fs from "fs";
import { filterOutput, resultParser, serializeResult } from "./parser";

const execCb = (command, error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }

  // console.log(`stdout:`, stdout);

  const filteredOutput = filterOutput(stdout);

  const currentTimestamp = Date.now();
  const logsFolder = `./logs/${currentTimestamp}`;

  fs.mkdirSync(logsFolder, { recursive: true });
  fs.writeFileSync(`${logsFolder}/${command}-output.log`, stdout);

  const result = resultParser(filteredOutput);
  fs.writeFileSync(
    `${logsFolder}/${command}-result.json`,
    serializeResult(result),
  );
};

const pairingCommand = async () => {
  exec("~/matter/bin/chip-tool pairing ble-wifi 0x1 OmniaRouter omnianetwork 20202021 3840", execCb.bind(null, 'pairing'));
  // exec(
  //   "~/matter/bin/chip-tool onoff on 0x1 0x1",
  //   execCb.bind(null, "onoff-on"),
  // );

  // const f = fs.readFileSync('./logs/1680802879113-pairing-output.log', 'utf8');

  // const filteredOutput = filterOutput(f);

  // const currentTimestamp = Date.now();

  // const logsFolder = `./logs/${currentTimestamp}`;

  // fs.mkdirSync(logsFolder, { recursive: true });

  // const result = resultParser(filteredOutput);
  // fs.writeFileSync(`${logsFolder}/test-result.json`, serializeResult(result));
};
