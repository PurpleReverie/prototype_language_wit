// Parser-side error subclass. Lives in its own module so the various
// parser-* helpers can throw without depending on parser.ts (which
// would otherwise create import cycles).

import { WitError } from './errors.js';

export class ParseError extends WitError {}
