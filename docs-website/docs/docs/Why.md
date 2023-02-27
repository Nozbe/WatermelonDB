---
title: Why Watermelon?
hide_title: true
---

## Why Watermelon?

**WatermelonDB** is a new way of dealing with user data in React Native and React web apps.

It's optimized for building **complex applications** in React Native, and the number one goal is **real-world performance**. In simple words, _your app must launch fast_.

For simple apps, using Redux or MobX with a persistence adapter is the easiest way to go. But when you start scaling to thousands or tens of thousands of database records, your app will now be slow to launch (especially on slower Android devices). Loading a full database into JavaScript is expensive!

Watermelon fixes it **by being lazy**. Nothing is loaded until it's requested. And since all querying is performed directly on the rock-solid [SQLite database](https://www.sqlite.org/index.html) on a separate native thread, most queries resolve in an instant.

But unlike using SQLite directly, Watermelon is **fully observable**. So whenever you change a record, all UI that depends on it will automatically re-render. For example, completing a task in a to-do app will re-render the task component, the list (to reorder), and all relevant task counters. [**Learn more**](https://www.youtube.com/watch?v=UlZ1QnFF4Cw).

| <a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-talk-thumbnail.jpg" alt="React Native EU: Next-generation React Databases" width="300" /></a> | <a href="https://watermelondb.now.sh/"><img src="https://github.com/Nozbe/WatermelonDB/raw/master/assets/watermelon-demo-thumbnail.png" alt="WatermelonDB Demo" width="300" /></a> |
| ---- | --- |
| <p align="center"><a href="https://www.youtube.com/watch?v=UlZ1QnFF4Cw">📺 <strong>Next-generation React databases</strong><br/>(a talk about WatermelonDB)</a></p> | <p align="center"><a href="https://watermelondb.now.sh/">✨ <strong>Check out web Demo</strong></a></p> |
