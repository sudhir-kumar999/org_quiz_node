import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores:["dist/**","node_modules/**"]
  },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],

    plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,

  {
    rules:{
      "no-unused-vars":"off",
      "@typescript-eslint/no-unused-vars":["warn"],
      "no-console":"warn",
      "quotes":["error","double"],
      "indent":["error",2],
      "no-multiple-empty-lines":["error",{max:1}],
      "padded-blocks":["error","never"],
      "semi":["error","always"]
    }
  }
]);
