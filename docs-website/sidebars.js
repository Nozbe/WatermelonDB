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
      'Get excited': [
        'docs/README',
        'docs/Demo',
      ],
      'Learn to use Watermelon': [
        'docs/Installation',
        'docs/Setup',
        'docs/Schema',
        'docs/Model',
        'docs/CRUD',
        'docs/Components',
        'docs/Query',
        'docs/Relation',
        'docs/Writers',
      ],
      'Advanced guides': [
        'docs/Advanced/Migrations',
        'docs/Advanced/Sync',
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
