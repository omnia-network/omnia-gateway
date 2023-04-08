import { format, transports, createLogger } from "winston";

const LOGS_PATH = `${process.cwd()}/logs`;

const logFormat = format.printf((info) => {
  return `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`;
});

export const matterControllerLogger = createLogger({
  format: format.combine(
    format.label({ label: "matter-controller" }),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    // Format the metadata object
    format.metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
  ),
  level: "debug",
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), logFormat),
    }),
    new transports.File({
      filename: `${LOGS_PATH}/${new Date().toISOString()}.log`,
      format: format.combine(
        // format.json(),
        // prettyPrint() can make the logs hard to query when they are big
        format.prettyPrint(),
      ),
    }),
  ],
});
