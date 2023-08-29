module.exports = {
  presets: [
    'module:metro-react-native-babel-preset',
  ],
  plugins: [
    "babel-plugin-transform-flow-enums",
    "@react-native/babel-plugin-codegen",
  ]
};