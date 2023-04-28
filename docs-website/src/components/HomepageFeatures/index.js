import clsx from 'clsx'
import React from 'react'
import styles from './styles.module.css'

const FeatureList = [
  {
    title: 'Fast',
    description: (
      <>
        WatemerlonDB was designed from the ground up to be blazing fast ⚡️ and launch your app
        instantly no matter how much data you have.
      </>
    ),
  },
  {
    title: 'Highly scalable',
    description: (
      <>
        WatermelonDB is built on rock-solid SQLite foundation and optimized to handle from hundreds
        to tens of thousands of records.
      </>
    ),
  },
  {
    title: 'Offline-first',
    description: (
      <>
        Ideal for offline-first apps, sync with your own server using WatermelonDB Powerful Sync
        Engine.
      </>
    ),
  },
]

function Feature({
  // Svg,
  title,
  description,
}) {
  return (
    <div className={clsx('col col--4')}>
      {/* <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div> */}
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
