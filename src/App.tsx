import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Preference = 'want' | 'neutral' | 'avoid'
type Tab = 'today' | 'menu'
type SourceType = 'home' | 'delivery' | 'restaurant' | 'convenience'
type BudgetLevel = 'low' | 'medium' | 'high'
type TimeLevel = 'quick' | 'normal' | 'slow'

type Dish = {
  id: string
  name: string
  category: string
  tags: string[]
  sourceType: SourceType
  budgetLevel: BudgetLevel
  timeLevel: TimeLevel
  note: string
  preferences: {
    personA: Preference
    personB: Preference
  }
  favorite: boolean
  lastEatenAt?: string
  createdAt: string
  updatedAt: string
}

type Filters = {
  search: string
  category: string
  tag: string
  preference: 'all' | 'bothWant' | 'personAWant' | 'personBWant' | 'avoidHidden' | 'includeAvoid'
}

type Decision = {
  dish: Dish
  reasons: string[]
  confirmed: boolean
}

type DishDraft = {
  name: string
  category: string
  tagsText: string
  sourceType: SourceType
  budgetLevel: BudgetLevel
  timeLevel: TimeLevel
  note: string
  personA: Preference
  personB: Preference
}

const STORAGE_KEY = 'couple-menu:v1'
const categories = ['家常', '外卖', '下馆子', '轻食', '甜品', '便利店']
const quickTags = ['快手', '便宜', '清淡', '辣', '热乎', '健康', '米饭', '面食', '汤汤水水']

const sourceLabels: Record<SourceType, string> = {
  home: '在家做',
  delivery: '叫外卖',
  restaurant: '出门吃',
  convenience: '便利店',
}

const budgetLabels: Record<BudgetLevel, string> = {
  low: '低预算',
  medium: '中预算',
  high: '高预算',
}

const timeLabels: Record<TimeLevel, string> = {
  quick: '快手',
  normal: '普通',
  slow: '慢慢来',
}

const preferenceLabels: Record<Preference, string> = {
  want: '想吃',
  neutral: '一般',
  avoid: '不想吃',
}

const preferenceIcons: Record<Preference, string> = {
  want: '♥',
  neutral: '•',
  avoid: '×',
}

const defaultDishes: Dish[] = [
  makeDish('番茄牛腩饭', '家常', ['热乎', '米饭', '下饭'], 'home', 'medium', 'normal', '适合周末多炖一点，第二天也好吃。', 'want', 'want', true, daysAgo(8)),
  makeDish('麻辣烫', '外卖', ['辣', '热乎', '快手'], 'delivery', 'medium', 'quick', '下雨天尤其适合，记得少放丸子。', 'want', 'neutral', false, daysAgo(2)),
  makeDish('寿司拼盘', '下馆子', ['清淡', '冷食'], 'restaurant', 'high', 'normal', '想吃清爽一点的时候选。', 'neutral', 'want', false),
  makeDish('鸡蛋三明治', '轻食', ['快手', '便宜', '健康'], 'home', 'low', 'quick', '早午餐都可以，配冰美式。', 'want', 'want', true, daysAgo(13)),
  makeDish('热干面', '外卖', ['面食', '快手', '香'], 'delivery', 'low', 'quick', '嘴馋但不想纠结时很稳。', 'neutral', 'want', false),
  makeDish('椰子鸡火锅', '下馆子', ['清淡', '热乎', '汤汤水水'], 'restaurant', 'high', 'slow', '适合认真吃一顿的晚上。', 'want', 'want', true, daysAgo(16)),
  makeDish('烤红薯和关东煮', '便利店', ['热乎', '便宜', '快手'], 'convenience', 'low', 'quick', '加班晚归的安全选项。', 'neutral', 'neutral', false),
  makeDish('芋泥蛋糕', '甜品', ['甜', '心情好'], 'restaurant', 'medium', 'quick', '不当正餐，适合饭后一起分。', 'want', 'avoid', false),
]

function makeDish(
  name: string,
  category: string,
  tags: string[],
  sourceType: SourceType,
  budgetLevel: BudgetLevel,
  timeLevel: TimeLevel,
  note: string,
  personA: Preference,
  personB: Preference,
  favorite = false,
  lastEatenAt?: string,
): Dish {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    category,
    tags,
    sourceType,
    budgetLevel,
    timeLevel,
    note,
    preferences: { personA, personB },
    favorite,
    lastEatenAt,
    createdAt: now,
    updatedAt: now,
  }
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

const emptyDraft: DishDraft = {
  name: '',
  category: '家常',
  tagsText: '',
  sourceType: 'home',
  budgetLevel: 'medium',
  timeLevel: 'normal',
  note: '',
  personA: 'neutral',
  personB: 'neutral',
}

function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [dishes, setDishes] = useState<Dish[]>(() => loadDishes())
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: '全部',
    tag: '全部',
    preference: 'avoidHidden',
  })
  const [decision, setDecision] = useState<Decision | null>(null)
  const [isPicking, setIsPicking] = useState(false)
  const [editingDish, setEditingDish] = useState<Dish | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dishes))
  }, [dishes])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const visibleDishes = useMemo(() => filterDishes(dishes, filters), [dishes, filters])
  const recommendedDish = useMemo(() => pickWeightedDish(visibleDishes), [visibleDishes])
  const recentDishes = useMemo(
    () => dishes.filter((dish) => dish.lastEatenAt).sort((a, b) => String(b.lastEatenAt).localeCompare(String(a.lastEatenAt))).slice(0, 5),
    [dishes],
  )

  const bothWantCount = dishes.filter((dish) => dish.preferences.personA === 'want' && dish.preferences.personB === 'want').length
  const candidateText = `${visibleDishes.length} 个可选`

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function showToast(message: string) {
    setToast(message)
  }

  function rollDish() {
    if (visibleDishes.length === 0) {
      setDecision(null)
      showToast('这组条件下没有菜啦，放宽一点试试？')
      return
    }
    setIsPicking(true)
    window.setTimeout(() => {
      const dish = pickWeightedDish(visibleDishes) ?? visibleDishes[0]
      setDecision({ dish, reasons: buildReasons(dish), confirmed: false })
      setIsPicking(false)
    }, 520)
  }

  function confirmDecision(dishId: string, markEaten = false) {
    const now = new Date().toISOString()
    setDecision((current) => current && current.dish.id === dishId ? { ...current, confirmed: true } : current)
    if (markEaten) {
      setDishes((current) => current.map((dish) => dish.id === dishId ? { ...dish, lastEatenAt: now, updatedAt: now } : dish))
      showToast('今晚就它啦，已记入最近吃过')
    } else {
      showToast('今晚就它啦')
    }
  }

  function toggleFavorite(dishId: string) {
    setDishes((current) => current.map((dish) => dish.id === dishId ? { ...dish, favorite: !dish.favorite, updatedAt: new Date().toISOString() } : dish))
  }

  function cyclePreference(dishId: string, person: 'personA' | 'personB') {
    const next: Record<Preference, Preference> = { neutral: 'want', want: 'avoid', avoid: 'neutral' }
    setDishes((current) => current.map((dish) => dish.id === dishId ? {
      ...dish,
      preferences: { ...dish.preferences, [person]: next[dish.preferences[person]] },
      updatedAt: new Date().toISOString(),
    } : dish))
  }

  function openCreateForm() {
    setEditingDish(null)
    setIsFormOpen(true)
  }

  function openEditForm(dish: Dish) {
    setEditingDish(dish)
    setIsFormOpen(true)
  }

  function saveDish(draft: DishDraft) {
    const now = new Date().toISOString()
    const tags = draft.tagsText.split(/[，,\s]+/).map((tag) => tag.trim()).filter(Boolean)
    if (editingDish) {
      setDishes((current) => current.map((dish) => dish.id === editingDish.id ? {
        ...dish,
        name: draft.name.trim(),
        category: draft.category,
        tags,
        sourceType: draft.sourceType,
        budgetLevel: draft.budgetLevel,
        timeLevel: draft.timeLevel,
        note: draft.note.trim(),
        preferences: { personA: draft.personA, personB: draft.personB },
        updatedAt: now,
      } : dish))
      showToast('已更新这道菜')
    } else {
      setDishes((current) => [{
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        category: draft.category,
        tags,
        sourceType: draft.sourceType,
        budgetLevel: draft.budgetLevel,
        timeLevel: draft.timeLevel,
        note: draft.note.trim(),
        preferences: { personA: draft.personA, personB: draft.personB },
        favorite: false,
        createdAt: now,
        updatedAt: now,
      }, ...current])
      showToast('已放进你们的小菜单')
    }
    setIsFormOpen(false)
    setEditingDish(null)
  }

  function deleteDish(dishId: string) {
    if (!window.confirm('确定要从小菜单里删除这道菜吗？')) return
    setDishes((current) => current.filter((dish) => dish.id !== dishId))
    if (decision?.dish.id === dishId) setDecision(null)
    setIsFormOpen(false)
    setEditingDish(null)
    showToast('已删除这道菜')
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(dishes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `couple-menu-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function importData(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Dish[]
        if (!Array.isArray(parsed)) throw new Error('invalid')
        setDishes(parsed)
        showToast('菜单已导入')
      } catch {
        showToast('导入失败，请检查 JSON 文件')
      }
    }
    reader.readAsText(file)
  }

  function resetDemoData() {
    if (!window.confirm('这会用示例数据覆盖当前本地菜单，确定吗？')) return
    setDishes(defaultDishes)
    setDecision(null)
    showToast('已恢复示例菜单')
  }

  return (
    <main className="app-shell">
      <div className="island-bg" aria-hidden="true">
        <span className="bubble bubble-a">🍙</span>
        <span className="bubble bubble-b">🍃</span>
        <span className="bubble bubble-c">♡</span>
      </div>

      <header className="wood-sign">
        <div>
          <p className="eyebrow">Couple Menu Island</p>
          <h1>今天吃什么？</h1>
          <p>从你们的小菜单里挑一个刚刚好。</p>
        </div>
        <div className="status-board" aria-label="菜单概览">
          <strong>{candidateText}</strong>
          <span>{dishes.length} 道菜 · {bothWantCount} 个心动选项</span>
        </div>
      </header>

      <nav className="tab-bar" aria-label="主导航">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>今日点菜</button>
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>你们的小菜单</button>
      </nav>

      <section className="layout-grid">
        <aside className="panel filter-panel">
          <div className="section-heading">
            <span>🔎</span>
            <div>
              <h2>筛选候选</h2>
              <p>先缩小范围，再随机。</p>
            </div>
          </div>
          <label className="field-label">
            搜索
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="搜索菜名、口味、地点" />
          </label>
          <ChipGroup label="分类" values={['全部', ...categories]} active={filters.category} onChange={(value) => updateFilter('category', value)} />
          <ChipGroup label="特点" values={['全部', ...quickTags]} active={filters.tag} onChange={(value) => updateFilter('tag', value)} />
          <ChipGroup
            label="偏好"
            values={['avoidHidden', 'bothWant', 'personAWant', 'personBWant', 'includeAvoid']}
            getLabel={(value) => ({ avoidHidden: '避开不想吃', bothWant: '双方都想吃', personAWant: '我想吃', personBWant: 'TA 想吃', includeAvoid: '包含不想吃' }[value] ?? value)}
            active={filters.preference}
            onChange={(value) => updateFilter('preference', value as Filters['preference'])}
          />
          <button className="ghost-button" onClick={() => setFilters({ search: '', category: '全部', tag: '全部', preference: 'avoidHidden' })}>放宽筛选</button>
        </aside>

        {tab === 'today' ? (
          <TodayPage
            decision={decision}
            isPicking={isPicking}
            recommendedDish={recommendedDish}
            recentDishes={recentDishes}
            visibleCount={visibleDishes.length}
            onRoll={rollDish}
            onConfirm={confirmDecision}
            onFavorite={toggleFavorite}
            onOpenCreate={openCreateForm}
          />
        ) : (
          <MenuPage
            dishes={visibleDishes}
            totalCount={dishes.length}
            onCreate={openCreateForm}
            onEdit={openEditForm}
            onCyclePreference={cyclePreference}
            onFavorite={toggleFavorite}
            onExport={exportData}
            onImport={importData}
            onReset={resetDemoData}
          />
        )}
      </section>

      <button className="fab" onClick={openCreateForm} aria-label="添加菜品">＋</button>
      {isFormOpen && <DishForm dish={editingDish} onClose={() => setIsFormOpen(false)} onSave={saveDish} onDelete={deleteDish} />}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </main>
  )
}

function loadDishes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultDishes
    const parsed = JSON.parse(stored) as Dish[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultDishes
  } catch {
    return defaultDishes
  }
}

function filterDishes(dishes: Dish[], filters: Filters) {
  const keyword = filters.search.trim().toLowerCase()
  return dishes.filter((dish) => {
    const matchesSearch = !keyword || [dish.name, dish.category, dish.note, ...dish.tags].some((item) => item.toLowerCase().includes(keyword))
    const matchesCategory = filters.category === '全部' || dish.category === filters.category
    const matchesTag = filters.tag === '全部' || dish.tags.includes(filters.tag) || sourceLabels[dish.sourceType] === filters.tag || timeLabels[dish.timeLevel] === filters.tag || budgetLabels[dish.budgetLevel] === filters.tag
    const { personA, personB } = dish.preferences
    const matchesPreference =
      filters.preference === 'includeAvoid' ||
      (filters.preference === 'avoidHidden' && personA !== 'avoid' && personB !== 'avoid') ||
      (filters.preference === 'bothWant' && personA === 'want' && personB === 'want') ||
      (filters.preference === 'personAWant' && personA === 'want') ||
      (filters.preference === 'personBWant' && personB === 'want')
    return matchesSearch && matchesCategory && matchesTag && matchesPreference
  })
}

function pickWeightedDish(dishes: Dish[]) {
  if (dishes.length === 0) return null
  const pool = dishes.flatMap((dish) => Array.from({ length: Math.max(1, scoreDish(dish)) }, () => dish))
  return pool[Math.floor(Math.random() * pool.length)]
}

function scoreDish(dish: Dish) {
  let score = 5
  const { personA, personB } = dish.preferences
  if (personA === 'want' && personB === 'want') score += 4
  else if (personA === 'want' || personB === 'want') score += 2
  if (personA === 'avoid' || personB === 'avoid') score -= 3
  if (dish.favorite) score += 1
  if (dish.lastEatenAt) {
    const days = (Date.now() - new Date(dish.lastEatenAt).getTime()) / 86400000
    if (days < 3) score -= 4
    else if (days < 7) score -= 2
  }
  return score
}

function buildReasons(dish: Dish) {
  const reasons: string[] = []
  if (dish.preferences.personA === 'want' && dish.preferences.personB === 'want') reasons.push('你们都标记过想吃')
  else if (dish.preferences.personA === 'want') reasons.push('你今天更想吃它')
  else if (dish.preferences.personB === 'want') reasons.push('TA 今天更想吃它')
  if (!dish.lastEatenAt) reasons.push('最近还没吃过')
  else {
    const days = Math.max(1, Math.floor((Date.now() - new Date(dish.lastEatenAt).getTime()) / 86400000))
    reasons.push(`${days} 天没吃过了`)
  }
  if (dish.timeLevel === 'quick') reasons.push('快手又不容易踩雷')
  if (dish.budgetLevel === 'low') reasons.push('预算友好')
  return reasons.slice(0, 3)
}

function TodayPage({ decision, isPicking, recommendedDish, recentDishes, visibleCount, onRoll, onConfirm, onFavorite, onOpenCreate }: {
  decision: Decision | null
  isPicking: boolean
  recommendedDish: Dish | null
  recentDishes: Dish[]
  visibleCount: number
  onRoll: () => void
  onConfirm: (dishId: string, markEaten?: boolean) => void
  onFavorite: (dishId: string) => void
  onOpenCreate: () => void
}) {
  return (
    <section className="today-column">
      <div className="panel hero-card note-card">
        <p className="eyebrow">今日推荐</p>
        {recommendedDish ? (
          <>
            <h2>{recommendedDish.name}</h2>
            <p>{buildReasons(recommendedDish).join(' · ')}</p>
            <DishMeta dish={recommendedDish} />
            <div className="button-row">
              <button className="primary-button" onClick={() => onConfirm(recommendedDish.id, true)}>就吃这个</button>
              <button className="secondary-button" onClick={onRoll}>换一个</button>
            </div>
          </>
        ) : (
          <EmptyState title="没有候选啦" text="放宽筛选，或者添加一道新菜。" action="添加菜品" onAction={onOpenCreate} />
        )}
      </div>

      <div className="panel picker-card">
        <div>
          <p className="eyebrow">随机点菜</p>
          <h2>{isPicking ? '正在翻菜单…' : '摇一摇小岛菜单'}</h2>
          <p aria-live="polite">当前候选池有 {visibleCount} 道菜。</p>
        </div>
        <button className="shuffle-button" onClick={onRoll} disabled={isPicking || visibleCount === 0}>{isPicking ? '翻菜单中' : '随机点菜'}</button>
      </div>

      {decision && <ResultCard decision={decision} onRoll={onRoll} onConfirm={onConfirm} onFavorite={onFavorite} />}

      <div className="panel recent-card">
        <div className="section-heading">
          <span>🧺</span>
          <div>
            <h2>最近吃过</h2>
            <p>避免连续几天都抽到同一种。</p>
          </div>
        </div>
        <div className="recent-strip">
          {recentDishes.length ? recentDishes.map((dish) => <span key={dish.id}>{dish.name} · {formatDate(dish.lastEatenAt)}</span>) : <span>还没有记录，确认一次晚餐就会出现。</span>}
        </div>
      </div>
    </section>
  )
}

function MenuPage({ dishes, totalCount, onCreate, onEdit, onCyclePreference, onFavorite, onExport, onImport, onReset }: {
  dishes: Dish[]
  totalCount: number
  onCreate: () => void
  onEdit: (dish: Dish) => void
  onCyclePreference: (dishId: string, person: 'personA' | 'personB') => void
  onFavorite: (dishId: string) => void
  onExport: () => void
  onImport: (file: File | undefined) => void
  onReset: () => void
}) {
  return (
    <section className="menu-column">
      <div className="panel menu-toolbar">
        <div>
          <p className="eyebrow">菜单维护</p>
          <h2>你们的小菜单</h2>
          <p>当前显示 {dishes.length} / {totalCount} 道菜。</p>
        </div>
        <div className="button-row wrap">
          <button className="primary-button" onClick={onCreate}>添加菜品</button>
          <button className="ghost-button" onClick={onExport}>导出 JSON</button>
          <label className="import-button">导入 JSON<input type="file" accept="application/json" onChange={(event) => onImport(event.target.files?.[0])} /></label>
          <button className="ghost-button" onClick={onReset}>恢复示例</button>
        </div>
      </div>
      {dishes.length ? (
        <div className="dish-grid">
          {dishes.map((dish) => <DishCard key={dish.id} dish={dish} onEdit={onEdit} onCyclePreference={onCyclePreference} onFavorite={onFavorite} />)}
        </div>
      ) : (
        <div className="panel"><EmptyState title="菜单还是空的" text="先加一道你们常吃的吧。" action="添加第一道菜" onAction={onCreate} /></div>
      )}
    </section>
  )
}

function ResultCard({ decision, onRoll, onConfirm, onFavorite }: {
  decision: Decision
  onRoll: () => void
  onConfirm: (dishId: string, markEaten?: boolean) => void
  onFavorite: (dishId: string) => void
}) {
  const { dish } = decision
  return (
    <div className={`panel result-card ${decision.confirmed ? 'confirmed' : ''}`} aria-live="polite">
      <p className="eyebrow">决定卡片</p>
      <h2>{decision.confirmed ? '今晚就它啦：' : '抽到的是'}</h2>
      <strong>{dish.name}</strong>
      <ul>
        {decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <DishMeta dish={dish} />
      <div className="button-row wrap">
        <button className="primary-button" onClick={() => onConfirm(dish.id, true)}>标记已吃</button>
        <button className="secondary-button" onClick={onRoll}>再换一个</button>
        <button className="ghost-button" onClick={() => onFavorite(dish.id)}>{dish.favorite ? '取消收藏' : '收藏'}</button>
      </div>
    </div>
  )
}

function DishCard({ dish, onEdit, onCyclePreference, onFavorite }: {
  dish: Dish
  onEdit: (dish: Dish) => void
  onCyclePreference: (dishId: string, person: 'personA' | 'personB') => void
  onFavorite: (dishId: string) => void
}) {
  return (
    <article className="dish-card">
      <div className="dish-card-top">
        <span className="category-badge">{dish.category}</span>
        <button className="icon-button" onClick={() => onFavorite(dish.id)} aria-label={dish.favorite ? '取消收藏' : '收藏'}>{dish.favorite ? '★' : '☆'}</button>
      </div>
      <h3>{dish.name}</h3>
      <DishMeta dish={dish} />
      <div className="pref-row" aria-label="双方偏好">
        <button className={`pref-pill ${dish.preferences.personA}`} onClick={() => onCyclePreference(dish.id, 'personA')}>我 {preferenceIcons[dish.preferences.personA]} {preferenceLabels[dish.preferences.personA]}</button>
        <button className={`pref-pill ${dish.preferences.personB}`} onClick={() => onCyclePreference(dish.id, 'personB')}>TA {preferenceIcons[dish.preferences.personB]} {preferenceLabels[dish.preferences.personB]}</button>
      </div>
      {dish.note && <p className="dish-note">{dish.note}</p>}
      <div className="dish-footer">
        <span>{dish.lastEatenAt ? `上次：${formatDate(dish.lastEatenAt)}` : '还没记录吃过'}</span>
        <button className="text-button" onClick={() => onEdit(dish)}>编辑</button>
      </div>
    </article>
  )
}

function DishMeta({ dish }: { dish: Dish }) {
  return (
    <div className="tag-list">
      <span>{sourceLabels[dish.sourceType]}</span>
      <span>{budgetLabels[dish.budgetLevel]}</span>
      <span>{timeLabels[dish.timeLevel]}</span>
      {dish.tags.map((tag) => <span key={tag}>{tag}</span>)}
    </div>
  )
}

function ChipGroup<T extends string>({ label, values, active, onChange, getLabel }: {
  label: string
  values: T[]
  active: T | string
  onChange: (value: T) => void
  getLabel?: (value: T) => string
}) {
  return (
    <div className="chip-group">
      <span>{label}</span>
      <div>
        {values.map((value) => <button key={value} className={active === value ? 'active' : ''} onClick={() => onChange(value)}>{getLabel ? getLabel(value) : value}</button>)}
      </div>
    </div>
  )
}

function DishForm({ dish, onClose, onSave, onDelete }: {
  dish: Dish | null
  onClose: () => void
  onSave: (draft: DishDraft) => void
  onDelete: (dishId: string) => void
}) {
  const [draft, setDraft] = useState<DishDraft>(() => dish ? {
    name: dish.name,
    category: dish.category,
    tagsText: dish.tags.join('，'),
    sourceType: dish.sourceType,
    budgetLevel: dish.budgetLevel,
    timeLevel: dish.timeLevel,
    note: dish.note,
    personA: dish.preferences.personA,
    personB: dish.preferences.personB,
  } : emptyDraft)
  const duplicateHint = draft.name.trim() && !dish ? '保存前可以确认一下是否已有相似菜名。' : ''

  function update<K extends keyof DishDraft>(key: K, value: DishDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.name.trim()) return
    onSave(draft)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={dish ? '编辑菜品' : '添加菜品'}>
      <form className="dish-form" onSubmit={submit}>
        <div className="form-header">
          <div>
            <p className="eyebrow">{dish ? '编辑菜品' : '添加菜品'}</p>
            <h2>{dish ? dish.name : '放进小菜单'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <label className="field-label">菜名<input required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="比如 番茄牛腩 / 麻辣烫 / 寿司" /></label>
        {duplicateHint && <p className="hint">{duplicateHint}</p>}
        <label className="field-label">它属于哪一类？<select value={draft.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="field-label">有什么特点？<input value={draft.tagsText} onChange={(event) => update('tagsText', event.target.value)} placeholder="辣，快手，热乎" /></label>
        <div className="form-grid">
          <label className="field-label">获取方式<select value={draft.sourceType} onChange={(event) => update('sourceType', event.target.value as SourceType)}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field-label">预算<select value={draft.budgetLevel} onChange={(event) => update('budgetLevel', event.target.value as BudgetLevel)}>{Object.entries(budgetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field-label">准备时间<select value={draft.timeLevel} onChange={(event) => update('timeLevel', event.target.value as TimeLevel)}>{Object.entries(timeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="form-grid two">
          <label className="field-label">我的偏好<select value={draft.personA} onChange={(event) => update('personA', event.target.value as Preference)}>{Object.entries(preferenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field-label">TA 的偏好<select value={draft.personB} onChange={(event) => update('personB', event.target.value as Preference)}>{Object.entries(preferenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label className="field-label">备注<textarea value={draft.note} onChange={(event) => update('note', event.target.value)} placeholder="店名、做法、忌口，或者你们的小暗号" /></label>
        <div className="form-actions">
          {dish && <button type="button" className="danger-button" onClick={() => onDelete(dish.id)}>删除</button>}
          <button type="button" className="ghost-button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit">保存</button>
        </div>
      </form>
    </div>
  )
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><strong>{title}</strong><p>{text}</p><button className="primary-button" onClick={onAction}>{action}</button></div>
}

function formatDate(value?: string) {
  if (!value) return '未知'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(value))
}

export default App
