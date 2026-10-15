// The version printed by --version and sent in the User-Agent, read from package.json at build time.
import { version } from '../package.json';

export const VERSION: string = version;
