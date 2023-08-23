module.exports = {
  // This is for auto-linking WatermelonDB as a library
  dependency: {
    platforms: {
      android: {
        sourceDir: './native/android',
      },
      windows: {
        sourceDir: '.\\native\\windows',
        solutionFile: 'WatermelonDB.sln',
        projects: [
          {
            projectFile: 'WatermelonDB\\WatermelonDB.vcxproj',
            directDependency: true,
          }
        ],
      },
    },
  },
  // This is for WatermelonDB project internals
  project: {
    android: {
      sourceDir: './native/androidTest',
    },
    ios: {
      sourceDir: './native/iosTest',
    },
    windows: {
      sourceDir: 'native\\windowsTest',
      solutionFile: 'WatermelonTester.sln',
      project: {
        projectFile: 'WatermelonTester\\WatermelonTester.vcxproj',
      },
    },
  },
}
