import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommended,
  // "essential" = correctness rules only (require-v-for-key, no-mutating-props,
  // …). Stylistic layout is Prettier's job, not lint's.
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      // rules/frontend.md "Vue": script-setup only, no Options API.
      "vue/component-api-style": ["error", ["script-setup"]],
      // rules/frontend.md "API layer": axios lives behind src/api/.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              message:
                "Components never import axios — call functions from src/api/*.ts (rules/frontend.md).",
            },
          ],
        },
      ],
      // rules/frontend.md "Vue": all date display goes through
      // src/utils/formatDate.ts — ad-hoc formatting drifts per component
      // and depends on the machine's locale/timezone (spec 4.9 §8 Q7).
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString']",
          message:
            "Use formatDate/formatMonth from src/utils/formatDate.ts (rules/frontend.md).",
        },
      ],
      // rules/frontend.md: no fetch in components; localStorage only inside
      // the auth store (single persistence point).
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use the api layer in src/api/*.ts (rules/frontend.md).",
        },
        {
          name: "localStorage",
          message:
            "Persistence lives inside the Pinia auth store only (rules/frontend.md).",
        },
      ],
    },
  },
  {
    // The api layer itself is the one place allowed to import axios.
    files: ["src/api/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // client.ts must never import a store: the store's login action calls the
    // client, so the reverse import is a circular dependency (rules/frontend.md).
    files: ["src/api/client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/stores/**"],
              message:
                "client.ts must not import stores — use setUnauthorizedHandler, wired in main.ts (rules/frontend.md).",
            },
          ],
        },
      ],
    },
  },
  {
    // The single persistence point for the token.
    files: ["src/stores/**"],
    rules: { "no-restricted-globals": "off" },
  }
);
