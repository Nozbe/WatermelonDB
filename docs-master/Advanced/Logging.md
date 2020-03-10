# Logging

By default, Watermelon ships with basic logging enabled that may be useful for debugging. When the application is started, basic information
about the location and setup of the database will be logged. As each query is executed, timing information will be logged.

## Disabling logging 

Disabling all logging is simple. Before your app starts, typically in your `database.js` file, import the logger and silence it:

```js
import logger from '@nozbe/watermelondb/utils/common/logger';
logger.silence();
```

## Overriding logging behavior

> **Note**: This class is not yet formally documented and its specifications may change. This method is for advanced users only, with
> some tolerance for potential breaking changes in the future.

The logger is a singleton instance of the Logger class, which exposes three methods: `log()`, `warn()`, and `error()`. Advanced users
may monkey-patch the logger methods to change their behavior, such as to route messages to an alternate logger: 

```js
import Cabin from 'cabin';
import logger from '@nozbe/watermelondb/utils/common/logger';

const cabin = new Cabin();
logger.log = (...messages) => cabin.info(...messages);
logger.warn = (...messages) => cabin.error(...messages);
logger.error = (...messages) => cabin.error(...messages);
```
