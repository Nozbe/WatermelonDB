/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
    docs: {
      'About': [
        'docs/README',
        'docs/Why',
        'docs/WhoUses',
        'docs/Example',
        'docs/Demo',
      ],
      'Setup': [
        'docs/Installation',
        'docs/Setup',
        'docs/Schema',
        'docs/Model',
        'docs/Advanced/Migrations',
      ],
      'Usage': [
        'docs/Relation',
        'docs/CRUD',
        'docs/Components',
        'docs/Query',
        'docs/Writers',
      ],
      'Sync': [
          'docs/Sync/Intro',
          'docs/Sync/Frontend',
          'docs/Sync/Backend',
          'docs/Sync/Limitations',
          'docs/Sync/FAQ',
          'docs/Sync/Troubleshoot',
          'docs/Sync/Contribute',
      ],
      'Advanced': [
        'docs/Advanced/CreateUpdateTracking',
        'docs/Advanced/AdvancedFields',
        'docs/Advanced/Flow',
        'docs/Advanced/LocalStorage',
        'docs/Advanced/ProTips',
        'docs/Advanced/Performance',
        'docs/Advanced/SharingDatabaseAcrossTargets',
      ],
      'Dig deeper into WatermelonDB': [
        'docs/Implementation/Architecture',
        'docs/Implementation/Adapters',
        'docs/Implementation/SyncImpl',
      ],
      'Other': [
        'docs/Roadmap',
        'docs/CONTRIBUTING',
        'docs/CHANGELOG',
      ],
    },
}

module.exports = sidebars
