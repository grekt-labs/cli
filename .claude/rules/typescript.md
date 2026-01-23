# TypeScript Rules

## Type Files

Separate types into `*.types.ts` files.

Exception: Types that are too simple can stay in the main file.

## Unknown vs Any

Avoid `any` at all costs. Use `unknown` instead.

## Example Structure

```
src/
└── featureName/
    ├── featureName.ts
    ├── featureName.test.ts
    └── featureName.types.ts
```
