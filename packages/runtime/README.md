# @witlang/runtime

Resolver + expander runtime for the Wit markup language.

## Install

```
npm install @witlang/runtime
```

## Use

```ts
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';

const doc = parse(source, 'inline');
const resolved = resolve(doc);
const expanded = expand(resolved);
```

See [github.com/PurpleReverie/prototype_language_wit](https://github.com/PurpleReverie/prototype_language_wit) for the language reference.
