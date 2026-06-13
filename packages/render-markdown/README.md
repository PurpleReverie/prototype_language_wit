# @witlang/render-markdown

Markdown renderer for the Wit markup language.

## Install

```
npm install @witlang/render-markdown
```

## Use

```ts
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';
import { renderMarkdown } from '@witlang/render-markdown';

const md = renderMarkdown(expand(resolve(parse(source, 'inline'))));
```

See [github.com/PurpleReverie/prototype_language_wit](https://github.com/PurpleReverie/prototype_language_wit) for the language reference.
