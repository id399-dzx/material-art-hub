import type { SoftwareHost, SoftwarePlugin } from './catalog.ts';

export type SoftwareVariant = {
  plugin: SoftwarePlugin;
  platform: 'windows' | 'mac' | 'default';
  label: string;
  hint: string;
};

export type SoftwareProduct = {
  id: string;
  name: string;
  host: SoftwareHost;
  summary: string;
  features: string[];
  version: string;
  variants: SoftwareVariant[];
};

// Platform editions keep their own package records and download permissions.
// Only explicit edition suffixes join a product; similar titles never do.
function edition(plugin: SoftwarePlugin): { name: string; variant: SoftwareVariant } {
  const match = /^(.*?)\s*·\s*(Windows|Mac|macOS)\s*版(?:（([^）]+)）)?$/.exec(plugin.name);
  if (!match || !match[1].trim()) return { name: plugin.name, variant: { plugin, platform: 'default', label: plugin.name, hint: '请查看运行环境与安装说明' } };
  const windows = match[2] === 'Windows';
  const appleSilicon = !windows && /Apple Silicon|ARM64|M 系列/i.test(`${match[3] ?? ''} ${plugin.packageName} ${plugin.environment.join(' ')}`);
  const x64 = windows && /x64|64 位/i.test(`${plugin.packageName} ${plugin.environment.join(' ')}`);
  return {
    name: match[1].trim(),
    variant: {
      plugin, platform: windows ? 'windows' : 'mac',
      label: windows ? `Windows${x64 ? ' x64' : ''}` : appleSilicon ? 'Mac · Apple Silicon' : `Mac${match[3] ? ` · ${match[3]}` : ''}`,
      hint: windows ? x64 ? '适用于 64 位 Intel / AMD 电脑，解压后运行' : '请按运行环境确认电脑架构' : appleSilicon ? '适用于 M 系列芯片，不适用于 Intel Mac' : '请按运行环境确认 Mac 芯片类型',
    },
  };
}

function sharedSummary(variants: SoftwareVariant[]): string {
  const summaries = variants.map(({ plugin }) => plugin.summary.match(/[^。！？]+[。！？]?/g) ?? [plugin.summary]);
  const common: string[] = [];
  for (const [index, sentence] of summaries[0].entries()) {
    if (!summaries.every(sentences => sentences[index] === sentence)) break;
    common.push(sentence);
  }
  return common.join('') || variants[0].plugin.summary;
}

export function groupSoftwareProducts(plugins: SoftwarePlugin[]): SoftwareProduct[] {
  const groups = new Map<string, SoftwareProduct>();
  for (const plugin of plugins) {
    const { name, variant } = edition(plugin);
    const key = variant.platform === 'default' ? `package:${plugin.id}` : JSON.stringify([plugin.host, name]);
    const product = groups.get(key);
    if (product) product.variants.push(variant);
    else groups.set(key, { id: plugin.id, name, host: plugin.host, summary: plugin.summary, features: plugin.features, version: plugin.version, variants: [variant] });
  }
  for (const product of groups.values()) {
    product.variants.sort((a, b) => Number(a.platform === 'mac') - Number(b.platform === 'mac'));
    product.id = product.variants[0].plugin.id;
    product.summary = sharedSummary(product.variants);
    product.features = [...new Set(product.variants.flatMap(({ plugin }) => plugin.features))];
    product.version = new Set(product.variants.map(({ plugin }) => plugin.version)).size === 1 ? product.variants[0].plugin.version : '按系统查看版本';
  }
  return [...groups.values()];
}

export function findSoftwareProduct(products: SoftwareProduct[], packageId: string): SoftwareProduct | undefined {
  return products.find(product => product.variants.some(({ plugin }) => plugin.id === packageId));
}

export function matchesSoftwareProduct(product: SoftwareProduct, host: SoftwareHost | '全部', query: string): boolean {
  return (host === '全部' || product.host === host) && [product.name, product.host, product.summary,
    ...product.variants.flatMap(({ plugin, label }) => [label, plugin.name, plugin.summary, ...plugin.outputs])]
    .join(' ').toLowerCase().includes(query.trim().toLowerCase());
}
