import { logger } from 'utils/common'

logger.silence()

// Ensure Loki web worker mock is used
jest.mock('adapters/lokijs/worker/index.worker')
