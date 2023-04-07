import winston from "winston";

const LOGS_PATH = `${process.cwd()}/logs`;

export const matterControllerLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    })
  ),
  transports: [
    new (winston.transports.Console)(),
  ]
});

export const getMatterControllerFileTransport = (filename: string): winston.transports.FileTransportInstance => {
  return new (winston.transports.File)({
    filename: `${LOGS_PATH}/${filename}.log`,
  });
}
