import { library } from "@rejot/eslint-config";

export default [
  ...library,
  {
    files: ["src/**/*.js?(x)", "src/**/*.ts?(x)"],
    rules: {
      "no-unused-vars": "off",
      "react/prop-types": [
        "warn",
        {
          ignore: ["className"],
        },
      ],
      "react/no-unknown-property": [
        "warn",
        {
          ignore: ["x-chunk"],
        },
      ],
    },
  },
];
