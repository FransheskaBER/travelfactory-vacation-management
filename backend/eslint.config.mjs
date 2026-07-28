import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "src/generated/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Enforces rules/backend.md "TypeORM": the DataSource is initialized
      // exactly once, in src/db/dataSource.ts.
      "no-restricted-syntax": [
        "error",
        {
          selector: 'NewExpression[callee.name="DataSource"]',
          message:
            "Import the shared DataSource from src/db/dataSource.ts — it is the only place TypeORM is initialized (rules/backend.md).",
        },
      ],
    },
  },
  {
    // The one file allowed to construct the DataSource.
    files: ["src/db/dataSource.ts"],
    rules: { "no-restricted-syntax": "off" },
  }
);
