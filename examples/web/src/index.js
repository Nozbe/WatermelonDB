// @flow

import React from 'react'
import { render } from 'react-dom'

import withObservables from '@nozbe/with-observables'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

import { Model } from '@nozbe/watermelondb'
import { field, text, children, nochange } from '@nozbe/watermelondb/decorators'

import Root from 'components/Root'

// eslint-disable-next-line
console.log(withObservables, LokiJSAdapter, Model, field, text, children, nochange)

render(<Root />, document.getElementById('application'))
