// Korean UI text, keyed by the English source string. Split by screen so
// each file stays manageable; later files win on duplicate keys.
import app from './app';
import data from './data';
import schema from './schema';
import servers from './servers';
import nosql from './nosql';

const ko: Record<string, string> = { ...servers, ...nosql, ...schema, ...data, ...app };
export default ko;
