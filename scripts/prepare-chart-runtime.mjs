import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const echartsRoot = dirname(require.resolve('echarts/package.json'));
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(projectRoot, 'public', 'chart-runtime');
await mkdir(output, { recursive: true });
await Promise.all([
    copyFile(join(echartsRoot, 'dist', 'echarts.min.js'), join(output, 'echarts.min.js')),
    copyFile(join(echartsRoot, 'LICENSE'), join(output, 'LICENSE.txt')),
    copyFile(join(echartsRoot, 'NOTICE'), join(output, 'NOTICE.txt')),
    copyFile(join(echartsRoot, 'licenses', 'LICENSE-d3'), join(output, 'LICENSE-d3.txt')),
]);
console.log('Prepared local ECharts runtime for the isolated chart editor.');
