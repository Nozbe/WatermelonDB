import { markdown, danger, warn, fail } from 'danger'

const github = danger.github
const pr = github.pr
const commits = github.commits
const modified = danger.git.modified_files
const bodyAndTitle = (pr.body + pr.title).toLowerCase()

// Check if a lot of changes
const linesDiff = pr.additions + pr.deletions
const kindaBigPRThreshold = 350
const bigPRThreshold = 600

if (linesDiff > bigPRThreshold) {
  warn(`Big pull request! Please split into smaller pull requests, if possible`)
} else if (linesDiff > kindaBigPRThreshold) {
  warn(`Pull request diff is getting big. It's OK, but try making smaller pull requests next time.`)
}

// Check if there are assignees
if (pr.assignees.length === 0) {
  warn(`Please select an assignee`)
}

// Add a CHANGELOG entry for app changes
const hasChangelog = modified.includes('CHANGELOG.md')
const isTrivial = bodyAndTitle.includes('#trivial')

if (!hasChangelog && !isTrivial) {
  warn('Please add a changelog entry for your changes. (Add #trivial to skip this.)')
}

// No PR is too small to warrant a paragraph or two of summary
if (pr.body.length === 0) {
  fail('Please add a description to your PR.')
}

// Warn if there are library changes, but not tests
const modifiedAppFiles = modified.filter(p => p.includes('src/'))
const hasAppChanges = modifiedAppFiles.length > 0

const testChanges = modifiedAppFiles.filter(filepath => /test/i.test(filepath))
const hasTestChanges = testChanges.length > 0

if (hasAppChanges && !hasTestChanges) {
  warn(
    'There are library changes, but not tests. That\'s OK as long as you\'re refactoring existing code',
  )
}

// Warn if someone wants to change peril settings
if (modified.filter(p => p.includes('peril'))) {
  fail('Peril settings are being changed')
}

// TODO: fs won't work in peril

// // Be careful of leaving testing shortcuts in the codebase
// const onlyTestFiles = testChanges.filter(x => {
//   const content = fs.readFileSync(x).toString();
//   return (
//     content.includes('it.only') ||
//     content.includes('describe.only') ||
//     content.includes('fdescribe') ||
//     content.includes('fit(')
//   );
// });
// raiseIssueAboutPaths(fail, onlyTestFiles, 'an `only` was left in the test');

// TODO: package size diff
