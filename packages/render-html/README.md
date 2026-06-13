# @witlang/render-html

HTML renderer for the Wit markup language.

## Install

```
npm install @witlang/render-html
```

## Use

```ts
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';
import { renderHtml } from '@witlang/render-html';

const html = renderHtml(expand(resolve(parse(source, 'inline'))));
```

See [github.com/PurpleReverie/prototype_language_wit](https://github.com/PurpleReverie/prototype_language_wit) for the language reference.
