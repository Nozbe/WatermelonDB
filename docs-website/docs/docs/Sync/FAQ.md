---
title: FAQ
hide_title: true
---

# Frequently Asked Questions

### Sync primitives and implementing your own sync entirely from scratch

See: [Sync implementation details](../Implementation/SyncImpl.md)


### Local vs Remote IDs

WatermelonDB has been designed with the assumption that there is no difference between Local IDs (IDs of records and their relations in a WatermelonDB database) and Remote IDs (IDs on the backend server). So a local app can create new records, generating their IDs, and the backend server will use this ID as the true ID. This greatly simplifies synchronization, as you don't have to replace local with remote IDs on the record and all records that point to it.

We highly recommend that you adopt this practice.

Some people are skeptical about this approach due to conflicts, since backend can guarantee unique IDs, and the local app can't. However, in practice, a standard Watermelon ID has 8,000,000,000,000,000,000,000,000 possible combinations. That's enough entropy to make conflicts extremely unlikely. At [Nozbe](https://nozbe.com), we've done it this way at scale for more than 15 years, and not once did we encounter a genuine ID conflict or had other issues due to this approach.

> Using the birthday problem, we can calculate that for 36^16 possible IDs, if your system grows to a billion records, the probability of a single conflict is 6e-8. At 100B records, the probability grows to 0.06%. But if you grow to that many records, you're probably a very rich company and can start worrying about things like this _then_.

If you absolutely can't adopt this practice, there's a number of production apps using WatermelonDB that keep local and remote IDs separate — however, more work is required this way. Search Issues to find discussions about this topic — and consider contributing to WatermelonDB to make managing separate local IDs easier for everyone!
