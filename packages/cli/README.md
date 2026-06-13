# @witlang/cli

Command-line tool for the Wit markup language — parse, check, build, tour.

## Install

```
npm install -g @witlang/cli
```

## Use

```bash
echo 'Hello *world*.' > x.wit
wit tour x.wit       # print parsed AST as a tree
wit check x.wit      # validate
wit build x.wit -o x.html
wit build x.wit -o x.md
```

See [github.com/PurpleReverie/prototype_language_wit](https://github.com/PurpleReverie/prototype_language_wit) for the language reference.
