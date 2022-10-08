import { ComponentType } from 'react'
import type Database from '../Database'
import { DatabaseConsumer } from './DatabaseContext'

type WithDatabaseProps<T> = T & {
  database: Database
}
// HoC to inject the database into the props of consumers
export default function withDatabase<T>(
  Component: ComponentType<WithDatabaseProps<T>>,
): DatabaseConsumer
