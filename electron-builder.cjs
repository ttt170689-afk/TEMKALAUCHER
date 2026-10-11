module.exports = {
  appId: 'com.temka.launcher',
  productName: 'TemkaLauncher',
  copyright: 'Copyright © 2026 Temka Studio',
  directories: { output: 'release', buildResources: 'assets' },
  files: ['dist/**/*', 'electron/**/*', 'assets/icon.png', 'package.json'],
  asar: true,
  npmRebuild: false,
  publish: [{ provider: 'github', owner: 'ttt170689-afk', repo: 'TEMKALAUCHER', releaseType: 'release' }],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.png',
    // No certificate has been supplied. Enable signing before wider public distribution.
    verifyUpdateCodeSignature: false,
    signExecutable: false
  },
  nsis: {
    oneClick: false, perMachine: false, allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true, createStartMenuShortcut: true,
    shortcutName: 'TemkaLauncher', deleteAppDataOnUninstall: false,
    artifactName: 'TemkaLauncher-Setup-${version}-${arch}.${ext}',
    differentialPackage: true
  }
};
