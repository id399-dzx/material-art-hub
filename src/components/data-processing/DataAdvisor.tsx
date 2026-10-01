'use client';

import { useId, useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { CHART_TEMPLATES, type ColumnMapping, type DataTable, type TemplateId } from '@/lib/data-processing/templates';
import { COLUMN_KINDS, PLOT_GOALS, profileTable, recommendCharts, type ColumnKind, type PlotGoal } from '@/lib/data-processing/profile';
import './research-tools.css';

const number = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('zh-CN', { maximumSignificantDigits: 5 });
export default function DataAdvisor({ table, mapping, onApply, demo, disabled = false, initialGoal = 'auto', initialGroup }: { table: DataTable; mapping: ColumnMapping; onApply: (id: TemplateId, mapping: ColumnMapping) => void; demo: boolean; disabled?: boolean; initialGoal?: PlotGoal; initialGroup?: number }) {
    const [overrides, setOverrides] = useState<Record<number, ColumnKind>>({}), [goal, setGoal] = useState<PlotGoal>(initialGoal);
    const headingId = useId();
    const initial = useMemo(() => profileTable(table), [table]);
    const [group, setGroup] = useState(() => initialGroup ?? initial.columns.find(column => column.kind === 'category')?.index ?? -1);
    const [value, setValue] = useState(() => mapping.ys[0] ?? mapping.x);
    const profile = useMemo(() => profileTable(table, overrides, group), [table, overrides, group]);
    const numeric = profile.columns.filter(column => column.kind === 'numeric' && column.index !== group);
    const currentValue = numeric.find(column => column.index === value)?.index ?? numeric[0]?.index ?? -1;
    const suggestions = recommendCharts(profile, goal, group, currentValue);
    const warnings = profile.columns.flatMap(column => [
        ...(column.missing ? [`${column.name}：缺失 ${column.missing} / ${profile.rows} 行 (${Math.round(column.missing / Math.max(1, profile.rows) * 100)}%)。`] : []),
        ...(column.invalid ? [`${column.name}：${column.invalid} 个值不符合指定类型，请检查原表。`] : []),
        ...(column.outliers ? [`${column.name}：${column.outliers} 个观测超出 1.5×IQR 范围；仅提示，仍保留数据。`] : []),
        ...(column.constant ? [`${column.name}为常量，不能计算其 Pearson 相关系数。`] : []),
    ]);
    const small = profile.groups.filter(item => (item.valid[currentValue] ?? 0) < 10);
    return <section className="research-advisor" aria-labelledby={headingId}>
        <header className="research-tool-heading"><span><Activity size={19} /></span><div><small>DATA ADVISOR</small><h3 id={headingId}>数据检查与绘图建议</h3><p>{demo ? '当前为演示数据。' : '检查当前工作表。'}检查在浏览器完成，不修改原始数据。</p></div><span className="research-local"><ShieldCheck size={13} />本地检查</span></header>
        <div className="research-summary"><div><strong>{profile.rows}</strong><span>非空数据行</span></div><div><strong>{numeric.length}</strong><span>数值列</span></div><div><strong>{profile.columns.reduce((sum, c) => sum + c.missing, 0)}</strong><span>缺失单元格</span></div><div><strong>{profile.blankRows}</strong><span>空行（不计样本）</span></div></div>
        <details className="research-details"><summary>查看字段与描述统计 · 可纠正类型识别</summary><div className="research-table-scroll"><table><thead><tr><th>字段</th><th>类型</th><th>有效 n</th><th>缺失 / 无效</th><th>范围</th><th>均值 / 中位数</th><th>样本 SD</th></tr></thead><tbody>{profile.columns.map(column => <tr key={column.index}><th>{column.name}</th><td><select aria-label={`${column.name}字段类型`} disabled={disabled} value={column.kind} onChange={event => setOverrides(current => ({ ...current, [column.index]: event.target.value as ColumnKind }))}>{Object.entries(COLUMN_KINDS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></td><td>{column.count}</td><td>{column.missing} / {column.invalid}</td><td>{column.kind === 'numeric' ? `${number(column.min)} ～ ${number(column.max)}` : `${column.unique} 个不同值`}</td><td>{number(column.mean)} / {number(column.median)}</td><td>{number(column.sd)}</td></tr>)}</tbody></table></div><p>数字 ID 请改为“文本 / ID”。日期识别支持年-月-日；SD 使用 n−1。异常值只标记，不自动删除。</p></details>
        <div className="research-advisor-fields"><label>想表达什么<select aria-label="绘图表达目的" disabled={disabled} value={goal} onChange={event => setGoal(event.target.value as PlotGoal)}>{Object.entries(PLOT_GOALS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>分组字段<select aria-label="数据检查分组字段" disabled={disabled} value={group} onChange={event => setGroup(Number(event.target.value))}><option value={-1}>不分组</option>{profile.columns.map(column => <option key={column.index} value={column.index}>{column.name}</option>)}</select></label><label>关注的数值<select aria-label="数据检查数值字段" disabled={disabled} value={currentValue} onChange={event => setValue(Number(event.target.value))}>{numeric.length ? numeric.map(column => <option key={column.index} value={column.index}>{column.name}</option>) : <option value={-1}>暂无数值列</option>}</select></label></div>
        {!!profile.groups.length && <div className="research-group-counts">{profile.groups.slice(0, 20).map(item => <span key={item.name}>{item.name}<strong>有效 n={item.valid[currentValue] ?? 0}</strong><small>共 {item.rows} 行</small></span>)}{profile.groups.length > 20 && <span>共 {profile.groups.length} 组，展示前 20 组</span>}</div>}
        {!!small.length && <p className="research-warning">{small.length} 组有效观测少于 10 个，建议保留原始点。请核对生物学重复 / 技术重复；表格行数不自动视为独立实验样本量。</p>}
        <div className="research-recommendations">{suggestions.map(item => <button key={item.id} type="button" disabled={disabled} onClick={() => onApply(item.id, item.mapping)}><span><strong>{CHART_TEMPLATES.find(template => template.id === item.id)!.name}</strong><small>{item.reason}</small></span><span>应用当前数据 <ArrowRight size={15} /></span></button>)}</div>
        {!suggestions.length && <p className="research-warning">当前字段与表达目的不足以推荐兼容图形。请纠正字段类型、选择分组或数值列；仍可手动选择模板。</p>}
        {!!warnings.length ? <details className="research-details"><summary>{warnings.length} 项数据提示</summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details> : <p className="research-check-success"><CheckCircle2 size={14} />未发现缺失、无效数值或 IQR 异常提示；这不代表统计结论已经验证。</p>}
        {!!profile.correlations.length && <details className="research-details"><summary>数值列的 Pearson 相关 · 逐对有效观测</summary><div className="research-table-scroll"><table><thead><tr><th>变量</th><th>有效配对 n</th><th>r</th></tr></thead><tbody>{profile.correlations.slice(0, 20).map(pair => <tr key={`${pair.a}-${pair.b}`}><td>{table.columns[pair.a]} / {table.columns[pair.b]}</td><td>{pair.n}</td><td>{pair.r === null ? '不足 3 对或常量，不计算' : pair.r.toFixed(3)}</td></tr>)}</tbody></table></div><p>最多检查前 12 个数值列，展示前 20 对。缺失值逐对排除，相关不代表因果，不自动计算显著性。</p></details>}
    </section>;
}
