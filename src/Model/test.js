/* eslint no-multi-spaces: 0 */

import { mergeMap } from 'rxjs/operators'
import { mockDatabase } from '../__tests__/testModels'
import { makeScheduler, expectToRejectWithMessage } from '../__tests__/utils'

import Database from '../Database'
import { appSchema, tableSchema } from '../Schema'
import { field, date, readonly } from '../decorators'
import { noop, allPromises } from '../utils/fp'
import { sanitizedRaw } from '../RawRecord'

import Model from './index'
import { fetchChildren } from './helpers'

const mockSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'mock',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'otherfield', type: 'string' },
        { name: 'col3', type: 'string' },
        { name: 'col4', type: 'string', isOptional: true },
        { name: 'number', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'mock_created',
      columns: [{ name: 'created_at', type: 'number' }],
    }),
    tableSchema({
      name: 'mock_updated',
      columns: [{ name: 'updated_at', type: 'number' }],
    }),
    tableSchema({
      name: 'mock_created_updated',
      columns: [
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})

class MockModel extends Model {
  static table = 'mock'

  @field('name')
  name

  @field('otherfield')
  otherfield
}

class MockModelCreated extends Model {
  static table = 'mock_created'

  @readonly
  @date('created_at')
  createdAt
}

class MockModelUpdated extends Model {
  static table = 'mock_updated'

  @readonly
  @date('updated_at')
  updatedAt
}

class MockModelCreatedUpdated extends Model {
  static table = 'mock_created_updated'

  @readonly
  @date('created_at')
  createdAt

  @readonly
  @date('updated_at')
  updatedAt
}

const makeDatabase = () =>
  new Database({
    adapter: { schema: mockSchema },
    modelClasses: [MockModel, MockModelCreated, MockModelUpdated, MockModelCreatedUpdated],
  })

describe('Model', () => {
  it(`exposes database`, () => {
    const database = makeDatabase()
    const model = new MockModel(database.get('mock'), {})
    expect(model.database).toBe(database)
    expect(model.db).toBe(database)
  })
  it('exposes collections', () => {
    const database = makeDatabase()
    const model = new MockModel(database.get('mock'), {})
    expect(model.collections).toBe(database.collections)
    expect(model.collections.get('mock_created').modelClass).toBe(MockModelCreated)
  })
  it(`has wmelon tag`, () => {
    const model = new MockModel({}, {})
    expect(model.constructor._wmelonTag).toBe('model')
  })
})

describe('CRUD', () => {
  it('_prepareCreate: can instantiate new records', () => {
    const database = makeDatabase()
    const collection = database.get('mock')
    const m1 = MockModel._prepareCreate(collection, record => {
      expect(record._isEditing).toBe(true)
      record.name = 'Some name'
    })

    expect(m1.collection).toBe(collection)
    expect(m1._isEditing).toBe(false)
    expect(m1._isCommitted).toBe(false)
    expect(m1.id.length).toBe(16)
    expect(m1.createdAt).toBe(undefined)
    expect(m1.updatedAt).toBe(undefined)
    expect(m1.name).toBe('Some name')
    expect(m1._raw).toEqual({
      id: m1.id,
      _status: 'created',
      _changed: '',
      name: 'Some name',
      otherfield: '',
      col3: '',
      col4: null,
      number: 0,
    })
  })
  it('_prepareCreateFromDirtyRaw: can instantiate new records', () => {
    const database = makeDatabase()
    const collection = database.get('mock')
    const m1 = MockModel._prepareCreateFromDirtyRaw(collection, { name: 'Some name' })

    expect(m1.collection).toBe(collection)
    expect(m1._isEditing).toBe(false)
    expect(m1._isCommitted).toBe(false)
    expect(m1.id.length).toBe(16)
    expect(m1.createdAt).toBe(undefined)
    expect(m1.updatedAt).toBe(undefined)
    expect(m1.name).toBe('Some name')
    expect(m1._raw).toEqual({
      id: m1.id,
      _status: 'created',
      _changed: '',
      name: 'Some name',
      otherfield: '',
      col3: '',
      col4: null,
      number: 0,
    })

    // can take the entire raw record without changing if it's valid
    const raw = Object.freeze({
      id: 'abcde67890123456',
      _status: 'synced',
      _changed: '',
      name: 'Hey',
      otherfield: 'foo',
      col3: '',
      col4: null,
      number: 100,
    })
    const m2 = MockModel._prepareCreateFromDirtyRaw(collection, raw)
    expect(m2._raw).toEqual(raw)
    expect(m2._raw).not.toBe(raw)
  })
  it('can update a record', async () => {
    const db = makeDatabase()
    await db.action(async () => {
      db.adapter.batch = jest.fn()
      const spyBatchDB = jest.spyOn(db, 'batch')

      const collection = db.get('mock')
      const m1 = await collection.create(record => {
        record.name = 'Original name'
      })

      const spyOnPrepareUpdate = jest.spyOn(m1, 'prepareUpdate')
      const observer = jest.fn()
      m1.observe().subscribe(observer)

      expect(m1._isEditing).toBe(false)

      const update = await m1.update(record => {
        expect(m1._isEditing).toBe(true)
        record.name = 'New name'
      })

      expect(spyBatchDB).toHaveBeenCalledWith(m1)
      expect(spyOnPrepareUpdate).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenCalledTimes(2)
      expect(update).toBe(m1)

      expect(m1.name).toBe('New name')
      expect(m1.updatedAt).toBe(undefined)
      expect(m1._isEditing).toBe(false)
      expect(m1._isCommitted).toBe(true)
      expect(m1._hasPendingUpdate).toBe(false)
    })
  })
  it('can prepare an update', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()

    const collection = db.get('mock')

    const m1 = await db.action(() => collection.create(record => {
      record.name = 'Original name'
    }))

    expect(db.adapter.batch).toHaveBeenCalledTimes(1)

    const observer = jest.fn()
    m1.observe().subscribe(observer)

    const preparedUpdate = m1.prepareUpdate(record => {
      expect(m1._isEditing).toBe(true)
      record.name = 'New name'
    })

    expect(preparedUpdate).toBe(m1)

    expect(m1.name).toBe('New name')
    expect(m1.updatedAt).toBe(undefined)
    expect(m1._isEditing).toBe(false)
    expect(m1._hasPendingUpdate).toBe(true)
    expect(db.adapter.batch).toHaveBeenCalledTimes(1)

    expect(observer).toHaveBeenCalledTimes(1)

    expect(m1._isCommitted).toBe(true)

    await db.action(() => db.batch(preparedUpdate))
  })
  it('can destroy a record permanently', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    const spyBatchDB = jest.spyOn(db, 'batch')

    const m1 = await db.action(() => db.get('mock').create())
    expect(spyBatchDB).toHaveBeenCalledWith(m1)

    const spyOnPrepareDestroyPermanently = jest.spyOn(m1, 'prepareDestroyPermanently')
    const nextObserver = jest.fn()
    const completionObserver = jest.fn()
    m1.observe().subscribe(nextObserver, null, completionObserver)

    await db.action(() => m1.destroyPermanently())

    expect(spyOnPrepareDestroyPermanently).toHaveBeenCalledTimes(1)

    expect(nextObserver).toHaveBeenCalledTimes(1)
    expect(completionObserver).toHaveBeenCalledTimes(1)
  })
  it('can destroy a record and its children permanently', async () => {
    const { db, projects, tasks, comments } = mockDatabase()
    await db.action(async () => {
      const project = await projects.create(mock => {
        mock.name = 'foo'
      })

      const task = await tasks.create(mock => {
        mock.project.set(project)
      })

      const comment = await comments.create(mock => {
        mock.task.set(task)
      })

      db.adapter.batch = jest.fn()
      const spyBatchDB = jest.spyOn(db, 'batch')

      const spyOnPrepareDestroyPermanentlyProject = jest.spyOn(project, 'prepareDestroyPermanently')
      const spyOnPrepareDestroyPermanentlyTask = jest.spyOn(task, 'prepareDestroyPermanently')
      const spyOnPrepareDestroyPermanentlyComment = jest.spyOn(comment, 'prepareDestroyPermanently')

      await project.experimentalDestroyPermanently()

      expect(spyOnPrepareDestroyPermanentlyProject).toHaveBeenCalledTimes(1)
      expect(spyOnPrepareDestroyPermanentlyTask).toHaveBeenCalledTimes(1)
      expect(spyOnPrepareDestroyPermanentlyComment).toHaveBeenCalledTimes(1)

      expect(spyBatchDB).toHaveBeenCalledWith(comment, task, project)
    })
  })
  it('can mark a record as deleted', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    const spyBatchDB = jest.spyOn(db, 'batch')

    const m1 = await db.action(() => db.get('mock').create())
    expect(spyBatchDB).toHaveBeenCalledWith(m1)

    const spyOnMarkAsDeleted = jest.spyOn(m1, 'prepareMarkAsDeleted')
    const nextObserver = jest.fn()
    const completionObserver = jest.fn()
    m1.observe().subscribe(nextObserver, null, completionObserver)

    await db.action(() => m1.markAsDeleted())

    expect(spyOnMarkAsDeleted).toHaveBeenCalledTimes(1)

    expect(nextObserver).toHaveBeenCalledTimes(1)
    expect(completionObserver).toHaveBeenCalledTimes(1)
  })
  it('can mark as deleted record and its children permanently', async () => {
    const { db, projects, tasks, comments } = mockDatabase()
    await db.action(async () => {
      const project = await projects.create(mock => {
        mock.name = 'foo'
      })

      const task = await tasks.create(mock => {
        mock.project.set(project)
      })

      const comment = await comments.create(mock => {
        mock.task.set(task)
      })

      db.adapter.batch = jest.fn()
      const spyBatchDB = jest.spyOn(db, 'batch')

      const spyOnPrepareMarkAsDeletedProject = jest.spyOn(project, 'prepareMarkAsDeleted')
      const spyOnPrepareMarkAsDeletedTask = jest.spyOn(task, 'prepareMarkAsDeleted')
      const spyOnPrepareMarkAsDeletedComment = jest.spyOn(comment, 'prepareMarkAsDeleted')

      await project.experimentalMarkAsDeleted()

      expect(spyOnPrepareMarkAsDeletedProject).toHaveBeenCalledTimes(1)
      expect(spyOnPrepareMarkAsDeletedTask).toHaveBeenCalledTimes(1)
      expect(spyOnPrepareMarkAsDeletedComment).toHaveBeenCalledTimes(1)

      expect(spyBatchDB).toHaveBeenCalledWith(comment, task, project)
    })
  })
})

describe('Safety features', () => {
  it('throws if batch is not called synchronously with prepareUpdate', async () => {
    // TODO: No clue how to implement this test
  })
  it('disallows field changes outside of create/update', () => {
    const db = makeDatabase()
    const model = new MockModel(db.get('mock'), {})

    expect(() => {
      model.name = 'new'
    }).toThrow()
    expect(() => {
      model.otherfield = 'new'
    }).toThrow()
    expect(() => {
      model._setRaw('name', 'new')
    }).toThrow()
    expect(() => {
      model._dangerouslySetRawWithoutMarkingColumnChange('name', 'new')
    }).toThrow()
  })
  it('disallows changes to just-deleted records', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    await db.action(async () => {
      const m1 = await db.get('mock').create()
      await m1.destroyPermanently()

      await expectToRejectWithMessage(
        m1.update(() => {
          m1.name = 'new'
        }),
        'Not allowed to change deleted records',
      )
    })
  })
  it('disallows changes to previously-deleted records', async () => {
    const db = makeDatabase()
    await db.action(async () => {
      const m1 = new MockModel(db.get('mock'), {
        _status: 'deleted',
      })

      await expectToRejectWithMessage(
        m1.update(() => {
          m1.name = 'new'
        }),
        'Not allowed to change deleted records',
      )
    })
  })
  it('diallows direct manipulation of id', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    await db.action(async () => {
      const model = await db.get('mock').create()

      await expectToRejectWithMessage(
        model.update(() => {
          model.id = 'newId'
        }),
        'Cannot set property id',
      )
    })
  })
  it('disallows operations on uncommited records', async () => {
    const db = makeDatabase()
    await db.action(async () => {
      const model = MockModel._prepareCreate(db.get('mock'), () => {})
      expect(model._isCommitted).toBe(false)

      await expectToRejectWithMessage(
        model.update(() => {}),
        'uncommitted',
      )
      await expectToRejectWithMessage(model.markAsDeleted(), 'uncomitted record as deleted')
      await expectToRejectWithMessage(model.destroyPermanently(), 'uncomitted record as deleted')
      expect(() => model.observe()).toThrow('uncommitted')
    })
  })
  it('disallows changes on records with pending updates', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    await db.action(async () => {
      const model = new MockModel(db.get('mock'), {})
      model.prepareUpdate()
      expect(() => {
        model.prepareUpdate()
      }).toThrow('pending update')
      await expectToRejectWithMessage(
        model.update(() => {}),
        'pending update',
      )

      await db.batch(model)
    })
  })
  it('disallows writes outside of an action', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()

    const model = await db.action(() => db.get('mock').create())

    await expectToRejectWithMessage(
      model.update(noop),
      'can only be called from inside of an Action',
    )

    await expectToRejectWithMessage(
      model.markAsDeleted(),
      'can only be called from inside of an Action',
    )

    await expectToRejectWithMessage(
      model.destroyPermanently(),
      'can only be called from inside of an Action',
    )

    await expectToRejectWithMessage(
      model.experimentalMarkAsDeleted(),
      'can only be called from inside of an Action',
    )

    await expectToRejectWithMessage(
      model.experimentalDestroyPermanently(),
      'can only be called from inside of an Action',
    )

    // check that no throw inside action
    await db.action(async () => {
      await model.update(noop)
      await model.markAsDeleted()
      await model.destroyPermanently()
      await model.experimentalMarkAsDeleted()
      await model.experimentalDestroyPermanently()
    })
  })
})

describe('Automatic created_at/updated_at', () => {
  it('_prepareCreate: sets created_at on create if model defines it', () => {
    const db = makeDatabase()
    const m1 = MockModelCreated._prepareCreate(db.get('mock_created'), noop)

    expect(m1.createdAt).toBeInstanceOf(Date)
    expect(+m1.createdAt).toBeGreaterThan(1500000000000)
    expect(m1.updatedAt).toBe(undefined)
  })
  it('_prepareCreate: sets created_at, updated_at on create if model defines it', () => {
    const db = makeDatabase()
    const m1 = MockModelCreatedUpdated._prepareCreate(db.get('mock_created_updated'), noop)

    expect(m1.createdAt).toBeInstanceOf(Date)
    expect(+m1.createdAt).toBe(+m1.updatedAt)
  })
  it('touches updated_at on update if model defines it', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    await db.action(async () => {
      const m1 = await db.get('mock_updated').create(record => {
        record._raw.updated_at -= 100
      })
      const updatedAt = +m1.updatedAt

      await m1.update()
      expect(+m1.updatedAt).toBeGreaterThan(updatedAt)
    })
  })
})

describe('RawRecord manipulation', () => {
  it('allows raw access via _getRaw', () => {
    const model = new MockModel(null, {
      col1: 'val1',
      col2: false,
      col3: null,
    })

    expect(model._getRaw('col1')).toBe('val1')
    expect(model._getRaw('col2')).toBe(false)
    expect(model._getRaw('col3')).toBe(null)

    model._raw.col1 = 'val2'
    expect(model._getRaw('col1')).toBe('val2')
  })
  it('allows raw writes via _setRaw', () => {
    const model = new MockModel(
      { schema: mockSchema.tables.mock },
      sanitizedRaw({ name: 'val1' }, mockSchema.tables.mock),
    )

    model._isEditing = true
    model._setRaw('name', 'val2')
    model._setRaw('otherfield', 'val3')

    expect(model._raw.name).toBe('val2')
    expect(model._raw.otherfield).toBe('val3')
  })
  it('allows raw writes via _dangerouslySetRawWithoutMarkingColumnChange', () => {
    const model = new MockModel(
      { schema: mockSchema.tables.mock },
      sanitizedRaw({ name: 'val1' }, mockSchema.tables.mock),
    )

    model._isEditing = true
    model._dangerouslySetRawWithoutMarkingColumnChange('name', 'val2')
    model._dangerouslySetRawWithoutMarkingColumnChange('otherfield', 'val3')

    expect(model._raw.name).toBe('val2')
    expect(model._raw.otherfield).toBe('val3')
  })
})

describe('Sync status fields', () => {
  it('adds to changes on _setRaw', () => {
    const model = new MockModel(
      { schema: mockSchema.tables.mock },
      sanitizedRaw({}, mockSchema.tables.mock),
    )

    model._isEditing = true
    model._setRaw('name', 'val1')
    model._setRaw('otherfield', 'val2')

    expect(model._raw._status).toBe('created')
    expect(model._raw._changed).toBe('')

    model._raw._status = 'updated'

    model._setRaw('col3', 'val3')
    model._setRaw('col3', 'val4')
    model._setRaw('col4', 'val5')
    model._setRaw('col3', 'val6')

    expect(model._raw._status).toBe('updated')
    expect(model._raw._changed).toBe('col3,col4')

    const model2 = new MockModel(
      { schema: mockSchema.tables.mock },
      sanitizedRaw({ id: 'xx', _status: 'synced' }, mockSchema.tables.mock),
    )
    model2._isEditing = true
    model2._setRaw('name', 'val1')

    expect(model2._raw._status).toBe('updated')
    expect(model2._raw._changed).toBe('name')
  })
  it('adds to changes on _setRaw (new behavior)', async () => {
    const model = new MockModel(
      { schema: mockSchema.tables.mock },
      sanitizedRaw({ col3: '', number: 0 }, mockSchema.tables.mock),
    )

    model._isEditing = true
    model._raw.id = 'xxx'
    model._raw._status = 'updated'

    model._setRaw('name', null) // ensure we're comparing sanitized values
    model._setRaw('otherfield', '')
    model._setRaw('col3', 'foo')
    model._setRaw('col4', undefined)
    model._setRaw('number', NaN)
    expect(model._raw._changed).toBe('col3')
    model._setRaw('number', 10)

    expect(model._raw).toEqual({
      _status: 'updated',
      _changed: 'col3,number',
      id: 'xxx',
      name: '',
      otherfield: '',
      col3: 'foo',
      col4: null,
      number: 10,
    })
  })
  it('does not change _changed fields when using _dangerouslySetRawWithoutMarkingColumnChange', () => {
    const model = new MockModel(
      { schema: mockSchema.tables.mock },
      sanitizedRaw({}, mockSchema.tables.mock),
    )

    model._isEditing = true
    model._raw._status = 'updated'

    model._dangerouslySetRawWithoutMarkingColumnChange('col3', 'foo')

    expect(model._raw.col3).toBe('foo')
    expect(model._raw._status).toBe('updated')
    expect(model._raw._changed).toBe('')

    model._setRaw('otherfield', 'heh')
    model._dangerouslySetRawWithoutMarkingColumnChange('number', 10)

    expect(model._raw._changed).toBe('otherfield')
  })
  it('marks new records as status:created', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()
    await db.action(async () => {
      const mock = await db.get('mock').create(record => {
        record.name = 'Initial name'
      })

      expect(mock._raw._status).toBe('created')
      expect(mock._raw._changed).toBe('')

      expect(mock.syncStatus).toBe('created')

      // updating a status:created record doesn't change anything
      await mock.update(record => {
        record.name = 'New name'
      })

      expect(mock.syncStatus).toBe('created')
      expect(mock._raw._changed).toBe('')
    })
  })
  it('marks updated records with changed fields', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()

    const mock = new MockModel(
      db.get('mock'),
      sanitizedRaw(
        {
          id: '',
          _status: 'synced',
          name: 'Initial name',
        },
        mockSchema.tables.mock,
      ),
    )

    // update
    await db.action(() => mock.update(record => {
      record.name = 'New name'
    }))

    expect(mock._raw._status).toBe('updated')
    expect(mock._raw._changed).toBe('name')

    // change another field
    await db.action(() => mock.update(record => {
      record.otherfield = 'New value'
    }))

    expect(mock._raw._status).toBe('updated')
    expect(mock._raw._changed).toBe('name,otherfield')

    // no duplicated change fields
    await db.action(() => mock.update(record => {
      record.name = 'New name 2'
    }))

    expect(mock._raw._changed).toBe('name,otherfield')
  })
  it('marks update_at as updated when auto-touched', async () => {
    const db = makeDatabase()
    db.adapter.batch = jest.fn()

    const m1 = new MockModelUpdated(db.get('mock_updated'), {})
    await db.action(() => m1.update())

    expect(m1._raw._status).toBe('updated')
    expect(m1._raw._changed).toBe('updated_at')
  })
})

describe('Model observation', () => {
  it('notifies Rx observers of changes and deletion', () => {
    const model = new MockModel(null, {})
    const scheduler = makeScheduler()

    const changes__ = '--a---a----a-a---b'
    const a________ = '---x|'
    const b________ = '--------x|'
    const c________ = 'x|'
    const aExpected = '---m--m----m-m---|'
    const bExpected = '--------m--m-m---|'
    const cExpected = 'm-m---m----m-m---|'

    scheduler.hot(changes__).subscribe(event => {
      event === 'a' ? model._notifyChanged() : model._notifyDestroyed()
    })

    const a$ = scheduler.hot(a________).pipe(mergeMap(() => model.observe()))
    const b$ = scheduler.hot(b________).pipe(mergeMap(() => model.observe()))
    const c$ = scheduler.hot(c________).pipe(mergeMap(() => model.observe()))

    scheduler.expectObservable(a$).toBe(aExpected, { m: model })
    scheduler.expectObservable(b$).toBe(bExpected, { m: model })
    scheduler.expectObservable(c$).toBe(cExpected, { m: model })
    scheduler.flush()
  })
  it('notifies subscribers of changes and deletion', async () => {
    const { tasks, db } = mockDatabase()
    await db.action(async () => {
      const task = await tasks.create()

      const observer1 = jest.fn()
      const unsubscribe1 = task.experimentalSubscribe(observer1)
      expect(observer1).toHaveBeenCalledTimes(0)

      await task.update()
      expect(observer1).toHaveBeenCalledTimes(1)
      expect(observer1).toHaveBeenLastCalledWith(false)

      const observer2 = jest.fn()
      const unsubscribe2 = task.experimentalSubscribe(observer2)
      expect(observer2).toHaveBeenCalledTimes(0)

      unsubscribe1()

      const observer3 = jest.fn()
      const unsubscribe3 = task.experimentalSubscribe(observer3)

      await task.update()

      expect(observer2).toHaveBeenCalledTimes(1)
      expect(observer3).toHaveBeenCalledTimes(1)

      unsubscribe2()

      await task.update()

      expect(observer3).toHaveBeenCalledTimes(2)
      expect(observer3).toHaveBeenLastCalledWith(false)

      await task.markAsDeleted()

      expect(observer3).toHaveBeenCalledTimes(3)
      expect(observer3).toHaveBeenLastCalledWith(true)

      unsubscribe3()
      unsubscribe3()

      expect(observer1).toHaveBeenCalledTimes(1)
      expect(observer2).toHaveBeenCalledTimes(1)
      expect(observer3).toHaveBeenCalledTimes(3)
    })
  })
  it('unsubscribe can safely be called more than once', async () => {
    const { tasks, db } = mockDatabase()
    const task = await db.action(() => tasks.create())

    const observer1 = jest.fn()
    const unsubscribe1 = task.experimentalSubscribe(observer1)
    expect(observer1).toHaveBeenCalledTimes(0)

    const unsubscribe2 = task.experimentalSubscribe(() => {})
    unsubscribe2()
    unsubscribe2()

    await db.action(() => task.update())

    expect(observer1).toHaveBeenCalledTimes(1)

    unsubscribe1()
  })
  it(`can subscribe with the same subscriber multiple times`, async () => {
    const { db, tasks } = mockDatabase()
    const task = await db.action(() => tasks.create())
    const trigger = () => db.action(() => task.update())
    const subscriber = jest.fn()

    const unsubscribe1 = task.experimentalSubscribe(subscriber)
    expect(subscriber).toHaveBeenCalledTimes(0)
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(1)
    const unsubscribe2 = task.experimentalSubscribe(subscriber)
    expect(subscriber).toHaveBeenCalledTimes(1)
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(3)
    unsubscribe2()
    unsubscribe2() // noop
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(4)
    unsubscribe1()
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(4)
  })
})

describe('model helpers', () => {
  it('checks if fetchChildren retrieves all the children', async () => {
    const { projects, tasks, comments, db } = mockDatabase()
    await db.action(async () => {
      const projectFoo = await projects.create(mock => {
        mock.name = 'foo'
      })
      const projectBar = await projects.create(mock => {
        mock.name = 'bar'
      })

      const commentPromise = async task => {
        const comment = await comments.create(mock => {
          mock.task.set(task)
        })
        const commentChildren = await fetchChildren(comment)
        expect(commentChildren).toHaveLength(0)
      }

      const taskPromise = async (project, commentsCount) => {
        const task = await tasks.create(mock => {
          mock.project.set(project)
        })
        await allPromises(commentPromise, Array(commentsCount).fill(task))
        const taskChildren = await fetchChildren(task)
        expect(taskChildren).toHaveLength(commentsCount)
      }

      await allPromises(project => taskPromise(project, 2), Array(2).fill(projectFoo))
      await allPromises(project => taskPromise(project, 3), Array(3).fill(projectBar))

      const fooChildren = await fetchChildren(projectFoo)
      const barChildren = await fetchChildren(projectBar)
      expect(fooChildren).toHaveLength(6) // 2 tasks + 4 comments
      expect(barChildren).toHaveLength(12) // 3 tasks + 9 comments
    })
  })
})
