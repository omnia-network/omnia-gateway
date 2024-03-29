module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "workspaces"],
  extends: ["prettier"],
  overrides: [
    {
      files: ["src/**/*.ts"],
      extends: [
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
        "plugin:import/recommended",
        "plugin:workspaces/recommended",
      ],
      rules: {
        "@typescript-eslint/no-floating-promises": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/unbound-method": "off",
        "@typescript-eslint/require-await": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "import/no-unresolved": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "@typescript-eslint/dot-notation": "warn",
        "@typescript-eslint/lines-between-class-members": "off",
        "import/order": [
          "error",
          {
            groups: [
              "builtin",
              "external",
              "internal",
              "parent",
              "sibling",
              "object",
              "type",
            ],
            pathGroupsExcludedImportTypes: ["builtin", "type"],
            alphabetize: {
              order: "asc",
            },
            "newlines-between": "never",
          },
        ],
        "sort-imports": [
          "error",
          {
            allowSeparatedGroups: true,
            ignoreDeclarationSort: true,
          },
        ],
      },
      parserOptions: {
        ecmaVersion: "latest",
        lib: ["esnext"],
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.eslint.json"],
        projectFolderIgnoreList: ["./*.cjs"],
      },
    },
  ],
};
