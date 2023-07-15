import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { SimpleDatabankMemory } from '../lib/simple-databank-memory.js';
import { SpamFilter } from '../lib/spamfilter.js';

chai.use(chaiAsPromised);

const should = chai.should();

describe('SpamFilter', () => {
  it('should be possible to create', () => {
    const filter = new SpamFilter(new SimpleDatabankMemory());
    should.exist(filter);
  });

  it('should be possible to train', async () => {
    const filter = new SpamFilter(new SimpleDatabankMemory());

    await filter.train('spam', { test: 'abc' })
      .should.eventually.have.keys(['cat', 'date', 'elapsed', 'object']);

    await filter.train('spam', { test: 'xyz' })
      .should.eventually.have.keys(['cat', 'date', 'elapsed', 'object']);
  });

  it('should be possible to test', async () => {
    const filter = new SpamFilter(new SimpleDatabankMemory());

    await filter.test({ test: 'abc' })
      .should.eventually.have.keys(['bestKeys', 'elapsed', 'isSpam', 'probability'])
      .and.property('isSpam', false);
  });
});
