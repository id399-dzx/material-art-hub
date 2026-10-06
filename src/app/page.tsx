"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, Box, ChevronDown, Filter, Image as ImageIcon,
  Layers, Search, Settings2, SlidersHorizontal, Sparkles, X, Zap,
} from "lucide-react";
import { useContentAdmin } from "@/components/admin/ContentProvider";
import { supabase } from "@/lib/supabase";
import { isPluginAsset } from "@/lib/software-plugins/catalog";
import "./home.css";

const TAG_CATEGORIES = {
  application: ["锌离子电池", "锂离子电池", "固态电池", "钠离子体系", "液流电池", "电催化", "光催化", "热催化", "柔性传感器", "水凝胶表皮电子", "智能织物", "超级电容器", "纳米医学", "海水淡化"],
  material: ["水凝胶", "金属有机框架(MOF)", "共价有机框架(COF)", "钙钛矿", "碳纳米管"],
  process: ["界面修饰", "晶粒取向", "形貌演变", "动态化学", "离子沉积", "电荷转移"],
  style: ["C4D源文件", "3D渲染", "微观剖面", "发光质感", "玻璃态", "极简线框"],
};

type TagCategory = keyof typeof TAG_CATEGORIES;
type SelectedTags = Record<TagCategory, string[]>;

interface CategorizedTag {
  label: string;
  items: string[];
}

interface FilterGroupProps {
  title: string;
  icon: React.ElementType;
  tags?: string[];
  categorizedTags?: CategorizedTag[];
  categoryKey: TagCategory;
  selectedTags: string[];
  onToggleTag: (category: TagCategory, tag: string) => void;
  defaultOpen?: boolean;
}

function FilterGroup({ title, icon: Icon, tags = [], categorizedTags, categoryKey, selectedTags, onToggleTag, defaultOpen = false }: FilterGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = "home-filter-" + categoryKey;

  const renderTag = (tag: string) => (
    <button
      key={tag}
      type="button"
      className={"home-tag-button" + (selectedTags.includes(tag) ? " is-selected" : "")}
      aria-pressed={selectedTags.includes(tag)}
      onClick={() => onToggleTag(categoryKey, tag)}
    >
      {tag}
    </button>
  );

  return (
    <section className={"home-filter-group home-filter-group--" + categoryKey}>
      <button
        type="button"
        className="home-filter-heading"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="home-filter-heading-main">
          <span className="home-filter-icon"><Icon size={17} strokeWidth={2} /></span>
          <span>{title}</span>
          {selectedTags.length > 0 && <span className="home-filter-count">{selectedTags.length}</span>}
        </span>
        <ChevronDown size={17} className={"home-filter-chevron" + (isOpen ? " is-open" : "")} />
      </button>
      {isOpen && (
        <div id={panelId} className="home-filter-options">
          {categorizedTags ? categorizedTags.map((category) => (
            <div key={category.label} className="home-filter-subgroup">
              <span className="home-filter-subtitle">{category.label}</span>
              <div className="home-tag-list">{category.items.map(renderTag)}</div>
            </div>
          )) : <div className="home-tag-list">{tags.map(renderTag)}</div>}
        </div>
      )}
    </section>
  );
}

interface Asset {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  source_file_url?: string;
  tags_process?: string[];
  tags_material?: string[];
  tags_application?: string[];
  tags_style?: string[];
}

export default function Home() {
  const { isAdmin } = useContentAdmin();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<SelectedTags>({
    application: [], material: [], process: [], style: [],
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const toggleTag = (category: TagCategory, tag: string) => {
    setSelectedTags((previous) => {
      const current = previous[category];
      return {
        ...previous,
        [category]: current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
      };
    });
  };

  const resetTags = () => setSelectedTags({ application: [], material: [], process: [], style: [] });
  const clearAll = () => {
    resetTags();
    setSearchQuery("");
  };

  useEffect(() => {
    async function fetchAssets() {
      setLoading(true);
      setLoadError(false);
      try {
        const { data, error } = await supabase
          .from("assets")
          .select("*")
          .eq("hidden", false)
          .order("created_at", { ascending: false });
        if (error) {
          console.warn("Error fetching assets:", error);
          setAssets([]);
          setLoadError(true);
        } else if (data) {
          setAssets(data.filter(asset => !isPluginAsset(asset)));
        }
      } catch (error) {
        console.warn("Exception fetching assets:", error);
        setAssets([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchAssets();
  }, [reloadKey]);

  const activeTags = (Object.entries(selectedTags) as [TagCategory, string[]][])
    .flatMap(([category, tags]) => tags.map((tag) => ({ category, tag })));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    const matchesTags =
      (selectedTags.application.length === 0 || (asset.tags_application || []).some((tag) => selectedTags.application.includes(tag))) &&
      (selectedTags.material.length === 0 || (asset.tags_material || []).some((tag) => selectedTags.material.includes(tag))) &&
      (selectedTags.process.length === 0 || (asset.tags_process || []).some((tag) => selectedTags.process.includes(tag))) &&
      (selectedTags.style.length === 0 || (asset.tags_style || []).some((tag) => selectedTags.style.includes(tag)));
    const matchesSearch = !normalizedQuery ||
      (asset.title || "").toLowerCase().includes(normalizedQuery) ||
      (asset.description || "").toLowerCase().includes(normalizedQuery);
    return matchesTags && matchesSearch;
  });

  return (
    <div className="material-home">
      <div className="home-shell">
        <div className="home-intro">
          <div className="home-intro-copy">
            <div className="home-eyebrow"><span className="home-eyebrow-dot" /> MATERIAL RESEARCH LIBRARY <span className="home-eyebrow-divider">/</span> 素材探索</div>
            <h1>让科研视觉，<br /><span>更有表达力。</span></h1>
            <p>按研究领域、材料体系与视觉风格寻找素材，快速定位适合图解、汇报与论文展示的视觉资源。</p>
          </div>
          <div className="home-intro-panel" aria-label="素材库概览">
            <div className="home-intro-panel-top"><Sparkles size={17} /><span>素材概览</span></div>
            <strong>{loading || loadError ? "—" : assets.length}</strong>
            <span className="home-intro-panel-caption">份可探索的科研素材</span>
            <div className="home-intro-orb" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>

        <div className="home-workspace">
          <aside className={"home-filter-panel" + (mobileFiltersOpen ? " is-mobile-open" : "")} aria-label="素材筛选">
            <div className="home-filter-top">
              <div>
                <span className="home-section-kicker">DISCOVER / 01</span>
                <h2><SlidersHorizontal size={19} /> 多维筛选</h2>
              </div>
              <div className="home-filter-actions">
                <button type="button" className="home-filter-reset" onClick={resetTags} disabled={activeTags.length === 0}>重置</button>
                <button type="button" className="home-filter-close" aria-label="关闭筛选" onClick={() => setMobileFiltersOpen(false)}><X size={18} /></button>
              </div>
            </div>
            <p className="home-filter-helper">选择多个标签，缩小到你需要的素材范围。</p>
            <div className="home-filter-groups">
              <FilterGroup
                title="应用领域"
                icon={Zap}
                categoryKey="application"
                selectedTags={selectedTags.application}
                onToggleTag={toggleTag}
                defaultOpen
                categorizedTags={[
                  { label: "电池储能", items: ["锌离子电池", "锂离子电池", "固态电池", "钠离子体系", "液流电池"] },
                  { label: "催化体系", items: ["电催化", "光催化", "热催化"] },
                  { label: "可穿戴电子", items: ["柔性传感器", "水凝胶表皮电子", "智能织物"] },
                  { label: "其他前沿应用", items: ["超级电容器", "纳米医学", "海水淡化"] },
                ]}
              />
              <FilterGroup title="材料体系" icon={Layers} categoryKey="material" selectedTags={selectedTags.material} onToggleTag={toggleTag} tags={TAG_CATEGORIES.material} />
              <FilterGroup title="物理 / 化学过程" icon={Activity} categoryKey="process" selectedTags={selectedTags.process} onToggleTag={toggleTag} tags={TAG_CATEGORIES.process} />
              <FilterGroup title="视觉风格" icon={ImageIcon} categoryKey="style" selectedTags={selectedTags.style} onToggleTag={toggleTag} tags={TAG_CATEGORIES.style} />
            </div>
          </aside>

          <main className="home-results">
            <div className="home-results-heading">
              <div>
                <span className="home-section-kicker">COLLECTION / 02</span>
                <h2>素材浏览 <span>{loading ? "正在加载" : loadError ? "暂时无法读取" : "共 " + filteredAssets.length + " 项"}</span></h2>
              </div>
              {isAdmin && <Link href="/admin?section=assets" className="home-filter-reset"><Settings2 size={15} /> 管理素材</Link>}
              <button
                type="button"
                className="home-mobile-filter-toggle"
                aria-expanded={mobileFiltersOpen}
                onClick={() => setMobileFiltersOpen((open) => !open)}
              >
                <Filter size={16} /> 筛选{activeTags.length ? " · " + activeTags.length : ""}
              </button>
            </div>

            <div className="home-search-wrap">
              <Search size={18} aria-hidden="true" />
              <label htmlFor="home-search" className="sr-only">搜索素材</label>
              <input
                id="home-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索锌离子电池、水凝胶界面、C4D源文件..."
              />
              {searchQuery && <button type="button" className="home-search-clear" aria-label="清除搜索" onClick={() => setSearchQuery("")}><X size={16} /></button>}
            </div>

            {activeTags.length > 0 && (
              <div className="home-active-filters" aria-label="已选筛选条件">
                <span>已选条件</span>
                {activeTags.map(({ category, tag }) => (
                  <button key={category + "-" + tag} type="button" onClick={() => toggleTag(category, tag)} aria-label={"移除 " + tag + " 筛选条件"}>
                    {tag} <X size={13} />
                  </button>
                ))}
                <button type="button" className="home-active-clear" onClick={resetTags}>清除标签</button>
              </div>
            )}

            {loading ? (
              <div className="home-card-grid" aria-label="正在加载素材">
                {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="home-card-skeleton"><div /><span /><span /></div>)}
              </div>
            ) : loadError ? (
              <div className="home-empty-state" role="alert">
                <div className="home-empty-icon"><Box size={26} /></div>
                <h3>素材暂时无法加载</h3>
                <p>连接素材库时遇到问题。数据处理工作台仍可使用。</p>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)}>重新加载素材</button>
                <Link href="/data-processing" className="home-empty-secondary">进入数据工作台</Link>
              </div>
            ) : filteredAssets.length ? (
              <div className="home-card-grid">
                {filteredAssets.map((asset) => {
                  const previewTags = [
                    ...(asset.tags_application || []),
                    ...(asset.tags_material || []),
                    ...(asset.tags_process || []),
                    ...(asset.tags_style || []),
                  ].slice(0, 3);
                  return (
                    <Link key={asset.id} href={"/asset/" + asset.id} className="home-asset-card">
                      <div className="home-asset-image">
                        {asset.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={asset.image_url} alt={asset.title || "科研素材预览"} loading="lazy" />
                        ) : <div className="home-asset-image-fallback"><ImageIcon size={36} /></div>}
                        {asset.source_file_url && <span className="home-asset-file-badge">源文件</span>}
                      </div>
                      <div className="home-asset-body">
                        <h3>{asset.title || "未命名素材"}</h3>
                        {asset.description && <p>{asset.description}</p>}
                        {previewTags.length > 0 && <div className="home-asset-tags">{previewTags.map((tag, index) => <span key={tag + "-" + index}>{tag}</span>)}</div>}
                        <div className="home-asset-footer"><span>{asset.source_file_url ? "查看素材与源文件" : "查看素材详情"}</span><ArrowUpRight size={17} /></div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="home-empty-state">
                <div className="home-empty-icon"><Box size={26} /></div>
                <h3>{normalizedQuery || activeTags.length ? "暂时没有匹配的素材" : "素材库暂时为空"}</h3>
                <p>{normalizedQuery || activeTags.length ? "没有找到符合当前搜索与筛选条件的素材，可以调整条件再试。" : "目前还没有已发布的科研素材，稍后再来看看。"}</p>
                {(normalizedQuery || activeTags.length > 0) && <button type="button" onClick={clearAll}>清除条件，查看全部素材</button>}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
