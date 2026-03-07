"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Box, Layers, Zap, Image as ImageIcon, ChevronDown, ChevronRight, Activity, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

const TAG_CATEGORIES = {
  application: ["锌离子电池", "锂离子电池", "固态电池", "钠离子体系", "液流电池", "电催化", "光催化", "热催化", "柔性传感器", "水凝胶表皮电子", "智能织物", "超级电容器", "纳米医学", "海水淡化"],
  material: ["水凝胶", "金属有机框架(MOF)", "共价有机框架(COF)", "钙钛矿", "碳纳米管"],
  process: ["界面修饰", "晶粒取向", "形貌演变", "动态化学", "离子沉积", "电荷转移"],
  style: ["C4D源文件", "3D渲染", "微观剖面", "发光质感", "玻璃态", "极简线框"]
};
interface CategorizedTag {
  label: string;
  items: string[];
}

interface FilterGroupProps {
  title: string;
  icon: React.ElementType;
  tags?: string[];
  categorizedTags?: CategorizedTag[];
  colorClass: string;
  defaultOpen?: boolean;
  categoryKey: keyof typeof TAG_CATEGORIES;
  selectedTags: string[];
  onToggleTag: (category: keyof typeof TAG_CATEGORIES, tag: string) => void;
}

// Collapsible Filter Group Component
const FilterGroup = ({ title, icon: Icon, tags = [], categorizedTags, colorClass, defaultOpen = true, categoryKey, selectedTags, onToggleTag }: FilterGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3 pb-2 border-b border-slate-800/50 last:border-0 last:pb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-white font-medium flex items-center justify-between hover:text-blue-400 transition-colors"
      >
        <span className="flex items-center gap-2"><Icon size={18} className={colorClass} /> {title}</span>
        {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      </button>
      {isOpen && (
        <div className="pt-2">
          {categorizedTags ? (
            <div className="space-y-4">
              {categorizedTags.map((cat: CategorizedTag) => (
                <div key={cat.label} className="space-y-2">
                  <div className="text-xs text-slate-500 px-1 font-medium">{cat.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map((tag: string) => (
                      <button
                        key={tag}
                        onClick={() => onToggleTag(categoryKey, tag)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${selectedTags.includes(tag)
                          ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => onToggleTag(categoryKey, tag)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${selectedTags.includes(tag)
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface Asset {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  tags_process?: string[];
  tags_material?: string[];
  tags_application?: string[];
  tags_style?: string[];
}

export default function Home() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTags, setSelectedTags] = useState<{
    application: string[];
    material: string[];
    process: string[];
    style: string[];
  }>({
    application: [],
    material: [],
    process: [],
    style: []
  });

  const toggleTag = (category: keyof typeof TAG_CATEGORIES, tag: string) => {
    setSelectedTags(prev => {
      const current = prev[category];
      if (current.includes(tag)) {
        return { ...prev, [category]: current.filter(t => t !== tag) };
      } else {
        return { ...prev, [category]: [...current, tag] };
      }
    });
  };

  const resetTags = () => {
    setSelectedTags({
      application: [],
      material: [],
      process: [],
      style: []
    });
  };

  const filteredAssets = assets.filter(asset => {
    // Check if application tags match (OR logic)
    const matchesApp = selectedTags.application.length === 0 ||
      (asset.tags_application || []).some(tag => selectedTags.application.includes(tag));

    // Check if material tags match (OR logic)
    const matchesMat = selectedTags.material.length === 0 ||
      (asset.tags_material || []).some(tag => selectedTags.material.includes(tag));

    // Check if process tags match (OR logic)
    const matchesProc = selectedTags.process.length === 0 ||
      (asset.tags_process || []).some(tag => selectedTags.process.includes(tag));

    // Check if style tags match (OR logic)
    const matchesStyle = selectedTags.style.length === 0 ||
      (asset.tags_style || []).some(tag => selectedTags.style.includes(tag));

    // Text search logic across title and description
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === "" ||
      (asset.title || "").toLowerCase().includes(searchLower) ||
      (asset.description || "").toLowerCase().includes(searchLower);

    // Cross-dimension uses AND logic, coupled with text search
    return matchesApp && matchesMat && matchesProc && matchesStyle && matchesSearch;
  });

  useEffect(() => {
    async function fetchAssets() {
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Error fetching assets:", error);
          setAssets([]);
        } else if (data) {
          setAssets(data);
        }
      } catch (err) {
        console.error("Exception fetching assets:", err);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [supabase]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-950 text-slate-300 font-sans overflow-hidden">

      {/* 左侧筛选栏 - 1/4 宽度 */}
      <aside className="w-1/4 min-w-[280px] max-w-[360px] bg-slate-900/50 border-r border-slate-800 flex flex-col backdrop-blur-md">
        <div className="h-14 flex flex-shrink-0 items-center px-6 border-b border-slate-800/60 bg-slate-900/30">
          <div className="flex items-center gap-2 text-slate-400 font-bold tracking-widest text-sm uppercase">
            <Filter size={16} />
            发现探索 / Discover
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-2"><Filter size={16} /> 多维筛选</span>
            <span onClick={resetTags} className="text-xs text-blue-500 cursor-pointer hover:text-blue-400 transition-colors">重置</span>
          </div>

          <FilterGroup
            title="应用领域"
            icon={Zap}
            colorClass="text-yellow-500"
            categoryKey="application"
            selectedTags={selectedTags.application}
            onToggleTag={toggleTag}
            categorizedTags={[
              { label: "电池储能", items: ['锌离子电池', '锂离子电池', '固态电池', '钠离子体系', '液流电池'] },
              { label: "催化体系", items: ['电催化', '光催化', '热催化'] },
              { label: "可穿戴电子", items: ['柔性传感器', '水凝胶表皮电子', '智能织物'] },
              { label: "其他前沿应用", items: ['超级电容器', '纳米医学', '海水淡化'] }
            ]}
          />

          <FilterGroup
            title="材料体系"
            icon={Layers}
            colorClass="text-purple-500"
            categoryKey="material"
            selectedTags={selectedTags.material}
            onToggleTag={toggleTag}
            tags={TAG_CATEGORIES.material}
          />

          <FilterGroup
            title="物理/化学过程"
            icon={Activity}
            colorClass="text-red-500"
            categoryKey="process"
            selectedTags={selectedTags.process}
            onToggleTag={toggleTag}
            tags={TAG_CATEGORIES.process}
          />

          <FilterGroup
            title="视觉风格"
            icon={ImageIcon}
            colorClass="text-green-500"
            categoryKey="style"
            selectedTags={selectedTags.style}
            onToggleTag={toggleTag}
            tags={TAG_CATEGORIES.style}
          />
        </div>
      </aside>

      {/* 右侧主内容区 - 3/4 宽度 */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* 独立于全局 Header 的当前页局部搜索与操作条 */}
        <div className="h-14 border-b border-slate-800/60 flex flex-shrink-0 items-center justify-between px-8 bg-slate-900/30 backdrop-blur z-10">
          <div className="relative w-full max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索锌离子电池、水凝胶界面、C4D源文件..."
              className="w-full bg-slate-950 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 text-white transition-all shadow-inner shadow-black/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6 flex-1 pr-2 pb-8">
              {filteredAssets.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/asset/${item.id}`)}
                  className="break-inside-avoid relative group cursor-pointer mb-6"
                >
                  {/* Outer Glow Effect behind the card */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-700 pointer-events-none"></div>

                  <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/80 transition-all duration-500 ease-out hover:-translate-y-2 hover:border-slate-500/70 z-10 w-full h-full">

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-auto object-cover transition-all duration-1000 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] group-hover:scale-110 group-hover:-rotate-1 opacity-80 group-hover:opacity-100 brightness-90 group-hover:brightness-110"
                    />

                    {/* Shimmer sweep effect */}
                    <div className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out delay-100 pointer-events-none" />

                    {/* Hover Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Hover Content Area */}
                    <div className="absolute inset-0 p-5 flex flex-col justify-end translate-y-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none">

                      <h4 className="text-white font-bold mb-3 line-clamp-2 leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] -translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-100">
                        {item.title}
                      </h4>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {[...(item.tags_process || []), ...(item.tags_material || []), ...(item.tags_application || []), ...(item.tags_style || [])].slice(0, 3).map((tag, index) => (
                          <span
                            key={tag}
                            style={{ transitionDelay: `${200 + index * 75}ms` }}
                            className="px-2 py-1 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-slate-900/60 text-blue-200 border border-blue-500/30 rounded backdrop-blur-md translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:animate-pulse"></div>
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="w-full translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-[400ms] pointer-events-auto">
                        <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold rounded-lg backdrop-blur-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.7)] group/btn">
                          <Download size={14} className="transition-transform group-hover/btn:-translate-y-1" />
                          <span className="group-hover/btn:text-blue-50 transition-colors">获取源文件</span>
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Display empty state if no assets match */}
          {!loading && filteredAssets.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-slate-500 space-y-4">
              <Box size={48} className="text-slate-700 opacity-50" />
              <p className="text-lg">
                {searchQuery ? `没有找到符合标签和关键词 "${searchQuery}" 的素材` : "暂无符合该多维条件的素材"}
              </p>
              <button
                onClick={() => {
                  resetTags();
                  setSearchQuery("");
                }}
                className="text-sm text-blue-500 hover:text-blue-400"
              >
                清除所有筛选条件与搜索
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}