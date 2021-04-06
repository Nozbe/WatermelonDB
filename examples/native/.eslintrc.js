module.exports = {
  root: true,

  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true
    },
    "ecmaVersion": 2018,
    "sourceType": "module"
  },
  extends: [
    'prettier',
    'prettier/flowtype'
  ]
};
