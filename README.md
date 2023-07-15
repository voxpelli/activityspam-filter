# ActivitySpam Filter

Extraction and modernization of the filters in [activityspam](https://gitlab.com/evanp/activityspam) + a minimal databank reimplementation

[![npm version](https://img.shields.io/npm/v/activityspam-filter.svg?style=flat)](https://www.npmjs.com/package/activityspam-filter)
[![npm downloads](https://img.shields.io/npm/dm/activityspam-filter.svg?style=flat)](https://www.npmjs.com/package/activityspam-filter)
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg)](https://github.com/voxpelli/eslint-config)
[![Module type: ESM](https://img.shields.io/badge/module%20type-esm-brightgreen)](https://github.com/voxpelli/badges-cjs-esm)
[![Types in JS](https://img.shields.io/badge/types_in_js-yes-brightgreen)](https://github.com/voxpelli/types-in-js)
[![Follow @voxpelli@mastodon.social](https://img.shields.io/mastodon/follow/109247025527949675?domain=https%3A%2F%2Fmastodon.social&style=social)](https://mastodon.social/@voxpelli)

## Usage

### Simple

```javascript
import { SpamFilter, SimpleDatabankRedis } from 'activityspam-filter';

// Configured like ioredis, so by default it will connect to localhost:6379
const redisDb = new SimpleDatabankRedis();
const filter = new SpamFilter(redisDb);

await filter.train('spam', foo);
await filter.train('ham', bar);
const { isSpam } = await filter.test(abc);
```

## `SpamFilter(db, [tokenizerOptions])`

* **db** – a `SimpleDatabank` compatible class such as the supplied `SimpleDatabankRedis`

## SpamFilter API

### `train(category, data) => Promise<SpamFilterTrainingResult>`

* **category** – should be either `spam` or `ham` depending on what kind of content to train it with
* **data** – should be an `object` or an `array` of the data that should be tokenized and trained on

Returns an `object` with properties:

* **cat** – the supplied `category`
* **object** – a stringified representation of the data that's been supplied
* **date** – the ISO date this training data was created
* **elapsed** – the amount of milliseconds the training took

### `test(data) => Promise<SpamFilterDecision>`

* **data** – should be an `object` or an `array` of the data that should be tokenized and tested

Returns an `object` with properties:

* **probability** – a number
* **isSpam** – a boolean
* **bestKeys** – a list of the best tokens
* **elapsed** – the amount of milliseconds the check took

## `SimpleDatabankRedis(ioRedisConfig)`

Configured like [ioredis](https://www.npmjs.com/package/ioredis) and provides a `SimpleDatabank` compatible implementation of that.

## Types

* `SimpleDatabank` – the structure of a [databank](https://www.npmjs.com/package/databank) style implementation

## See also

* [activityspam](https://gitlab.com/evanp/activityspam)
* [databank](https://www.npmjs.com/package/databank)
* [ioredis](https://www.npmjs.com/package/ioredis)
