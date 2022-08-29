// @flow

import type Model from '../Model'
import type Database from '../Database'
import type { QueryDescription } from '../QueryDescription'

import type { QueryAssociation } from './index'

export function getAssociations(
  description: QueryDescription,
  modelClass: Model,
  db: Database,
): QueryAssociation[]