import type Model from './index'
import{$Exact} from '../types'

type TimestampsObj = $Exact<{ created_at?: number, updated_at?: number }>
export function createTimestampsFor(model: Model): TimestampsObj;

export function fetchDescendants(model: Model): Promise<Model[]>