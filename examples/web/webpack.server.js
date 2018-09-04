#!/usr/bin/env node

const serve = require('webpack-serve')
const compress = require('compression')
const proxy = require('http-proxy-middleware')
const convert = require('koa-connect')
const Router = require('koa-router')

const config = require('./webpack.dev')

const router = new Router()

router.get('*', convert(proxy({ target: 'http://localhost:8888', pathRewrite: { '.+': '/' } })))

serve(
  {},
  {
    config,
    hot: false,
    logLevel: 'info',
    port: 8888,
    add: (app, middleware) => {
      middleware.webpack().then(() => {
        middleware.content({
          index: 'index.html',
        })

        app.use(convert(compress()))
        app.use(router.routes())
      })
    },
  },
).then(server => {
  server.on('listening', () => {
    // eslint-disable-next-line
    console.log('happy coding!')
  })
})
