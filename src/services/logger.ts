import { Logger, createLogger, format, transports } from "winston";

const LOGS_PATH = `${process.cwd()}/logs`;

const logFormat = format.printf((info) => {
  return `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`;
});

/**
 * Create a logger with the given label and common format
 * @param {string} label The label to use for the logger
 * @returns {winston.Logger} The logger
 */
export const getLogger = (label: string): Logger => {
  return createLogger({
    format: format.combine(
      format.label({ label }),
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      // Format the metadata object
      format.metadata({
        fillExcept: ["message", "level", "timestamp", "label"],
      }),
    ),
    level: "debug",
    transports: [
      new transports.Console({
        format: format.combine(format.colorize(), logFormat),
      }),
      new transports.File({
        filename: `${LOGS_PATH}/${new Date().toISOString()}-${label}.log`,
        format: format.combine(
          // format.json(),
          // prettyPrint() can make the logs hard to query when they are big
          format.prettyPrint(),
        ),
      }),
    ],
  });
};
