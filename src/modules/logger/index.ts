import winston from "winston";

const addCustomFields = winston.format((info) => {
  info.code = info.code || "SYSTEM_ERROR";
  info.date = info.timestamp ? new Date(info.timestamp as string).toISOString() : new Date().toISOString();
  return info;
});

const createLogger = () => {
  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.timestamp(),
      addCustomFields(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console()
    ],
  });
};

export const logger = createLogger();
