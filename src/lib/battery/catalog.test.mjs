import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const news = JSON.parse(fs.readFileSync(new URL('../../data/battery/news.json', import.meta.url)));
const companies = JSON.parse(fs.readFileSync(new URL('../../data/battery/companies.json', import.meta.url)));
test('battery snapshot only publishes the explicit public summary contract', () => {
  assert(news.items.length > 0);
  assert.equal(new Set(news.items.map(item => item.id)).size, news.items.length);
  const fields = ['id', 'title', 'summary', 'reason', 'source', 'originalUrl', 'publishedAt', 'timelineAt', 'category', 'tags', 'selected'].sort();
  for (const item of news.items) {
    assert.deepEqual(Object.keys(item).sort(), fields);
    assert(item.title && item.source);
    const url = new URL(item.originalUrl);
    assert(['https:', 'http:'].includes(url.protocol));
    assert(!url.username && !url.password && !['localhost', '127.0.0.1'].includes(url.hostname));
    assert(['electrode-materials', 'bms', 'methods-tools', null].includes(item.category));
  }
});
test('company snapshot preserves all original reference names and official evidence', () => {
  assert.equal(companies.companies.length, 45);
  assert.equal(companies.references.reduce((n, reference) => n + reference.names.length, 0), 237);
  for (const company of companies.companies) for (const location of company.locations) {
    assert(companies.cities.some(city => city.name === location.city));
    assert.equal(new URL(location.source).protocol, 'https:');
  }
});
