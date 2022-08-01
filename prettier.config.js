module.exports = {
  printWidth: 100,
  trailingComma: 'all',
  semi: false,
  singleQuote: true,
  bracketSpacing: true,
  overrides: [
    {
      files: '*.js',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.ts',
      options: {
        parser: 'typescript',
      },
    },
  ],
}
