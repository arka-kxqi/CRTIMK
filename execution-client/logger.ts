// winston.format.colorize(),
//     winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
import {createLogger, format, transports} from "winston";

const LOG_LEVEL = process.env.LOG_LEVEL || "debug";


export const logger = createLogger({
    level: LOG_LEVEL,
    format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new transports.Console({}),
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log', level: 'info'}),
    ],
});