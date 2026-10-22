'use client';

import { useId } from 'react';
import { BatteryCharging, Box, Check, ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import './product-switcher.css';

export default function ProductSwitcher() {
  const id = useId();
  const battery = usePathname().startsWith('/battery');
  const Icon = battery ? BatteryCharging : Box;
  return <div className="product-switcher">
    <button type="button" popoverTarget={id} className="product-switcher__trigger" aria-label={`切换产品，当前为${battery ? '电池资讯' : 'Fesilent Reverie'}`}>
      <Icon size={23} /><span>{battery ? 'Fesilent 电池资讯' : 'Fesilent Reverie'}</span><ChevronDown size={15} />
    </button>
    <div id={id} popover="auto" className="product-switcher__panel">
      <nav aria-label="Fesilent 产品切换">
        <p>FESILENT / 工作空间</p>
        {[{ href: '/battery', title: '电池资讯', note: '论文、BMS、方法与开源', icon: BatteryCharging, active: battery },
          { href: '/reverie', title: 'Fesilent Reverie', note: '科研素材、数据处理与工具', icon: Box, active: !battery }].map(product => <a
            href={product.href} key={product.href} aria-current={product.active ? 'page' : undefined}
            onClick={event => event.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover()}>
          <span className="product-switcher__icon"><product.icon size={23} /></span>
          <span className="product-switcher__copy"><strong>{product.title}</strong><small>{product.note}</small></span>
          {product.active && <Check size={17} aria-label="当前产品" />}
        </a>)}
      </nav>
    </div>
  </div>;
}
