// @flow
/* eslint-disable no-console */

import toPairs from '../../utils/fp/toPairs'
import isRN from '../../utils/common/isRN'

if (process.env.NODE_ENV === 'production') {
  throw new Error('debugPrintChanges() MUST NOT BE USED IN PRODUCTION!')
}

if (!isRN) {
  console.log(
    '%c debugPrintChanges() is enabled!',
    `font-size: 40px; background: red; color: white; font-weight: bold`,
  )
}
console.warn('WARNING: DO NOT commit import of @nozbe/watermelondb/sync/debugPrintChanges!')

export default function debugPrintChanges(changes: null, isPush: boolean): void {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  const pushPullColor = isPush ? 'red' : 'blue'

  if (isRN) {
    console.log('========================================================================')
    console.log('##                                                                    ##')
    isPush &&
      console.log('##                         PUSHING CHANGES                            ##')
    !isPush &&
      console.log('##                             PULLING                                ##')
    console.log('##                                                                    ##')
    console.log('========================================================================')
  } else {
    console.log(
      `%c --- ${isPush ? 'PUSHING CHANGES' : 'PULLING'} --- `,
      `font-size: 40px; background: #eee; color: ${pushPullColor}; font-weight: bold`,
    )
  }

  toPairs(changes).forEach(([table, tableChanges]) => {
    toPairs(tableChanges).forEach(([changeType, records]) => {
      if (records.length) {
        const typeToColor = {
          created: '#22cc33',
          updated: 'orange',
          deleted: 'red',
        }

        if (isRN) {
          console.log(`| ${isPush ? 'pushing!' : 'PULL'} | ${table} | ${changeType} |`)
          console.log('________________________________________________________________________')
        } else {
          console.log(
            `%c ${isPush ? 'pushing!' : 'PULL'} %c ${table} %c ${changeType} `,
            `font-size: 20px; background: #eee; color: ${pushPullColor}; font-weight: bold`,
            'font-size: 20px; background: black; color: white',
            `font-size: 20px; background: ${typeToColor[changeType]}; color: white`,
          )
        }
        console.table(records)
      }
    })
  })

  if (isRN) {
    console.log('============================')
    console.log('##                        ##')
    console.log('##          DONE          ##')
    console.log('##                        ##')
    console.log('============================')
  } else {
    console.log(
      '%c done ',
      `font-size: 20px; background: #eee; color: ${pushPullColor}; font-weight: bold`,
    )
  }
}
