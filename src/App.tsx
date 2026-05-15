import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Preference = 'want' | 'neutral' | 'avoid'
type Tab = 'today' | 'menu'
type SourceType = 'home' | 'delivery' | 'restaurant' | 'convenience'
type BudgetLevel = 'low' | 'medium' | 'high'
type TimeLevel = 'quick' | 'normal' | 'slow'
type CompanionMode = 'both' | 'personA' | 'personB'
type AvoidMode = 'avoid' | 'relaxed'
type SceneMode = 'any' | SourceType
type SpeedMode = 'any' | 'quick' | 'normal'
type DecisionStage = 'idle' | 'candidate' | 'decided'

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

type TodayConditions = {
  companion: CompanionMode
  avoidMode: AvoidMode
  scene: SceneMode
  speed: SpeedMode
}

type MenuFilters = {
  search: string
  category: string
  tag: string
  preference: 'all' | 'bothWant' | 'personAWant' | 'personBWant' | 'avoidOnly'
}

type Decision = {
  stage: DecisionStage
  dish: Dish | null
  reasons: string[]
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
  low: '省一点',
  medium: '正常花',
  high: '吃好点',
}

const timeLabels: Record<TimeLevel, string> = {
  quick: '快一点',
  normal: '不赶时间',
  slow: '慢慢吃',
}

const preferenceLabels: Record<Preference, string> = {
  want: '想吃',
  neutral: '一般',
  avoid: '不想吃',
}

const sourceTypes: SourceType[] = ['home', 'delivery', 'restaurant', 'convenience']
const budgetLevels: BudgetLevel[] = ['low', 'medium', 'high']
const timeLevels: TimeLevel[] = ['quick', 'normal', 'slow']
const preferences: Preference[] = ['want', 'neutral', 'avoid']

const defaultConditions: TodayConditions = {
  companion: 'both',
  avoidMode: 'avoid',
  scene: 'any',
  speed: 'any',
}

const defaultMenuFilters: MenuFilters = {
  search: '',
  category: '全部',
  tag: '全部',
  preference: 'all',
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
  return { id: crypto.randomUUID(), name, category, tags, sourceType, budgetLevel, timeLevel, note, preferences: { personA, personB }, favorite, lastEatenAt, createdAt: now, updatedAt: now }
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [dishes, setDishes] = useState<Dish[]>(() => loadDishes())
  const [conditions, setConditions] = useState<TodayConditions>(defaultConditions)
  const [isConditionOpen, setIsConditionOpen] = useState(false)
  const [menuFilters, setMenuFilters] = useState<MenuFilters>(defaultMenuFilters)
  const [decision, setDecision] = useState<Decision>({ stage: 'idle', dish: null, reasons: [] })
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

  const todayDishes = useMemo(() => filterTodayDishes(dishes, conditions), [dishes, conditions])
  const hiddenAvoidCount = useMemo(() => conditions.avoidMode === 'avoid' ? dishes.filter((dish) => dish.preferences.personA === 'avoid' || dish.preferences.personB === 'avoid').length : 0, [dishes, conditions.avoidMode])
  const menuDishes = useMemo(() => filterMenuDishes(dishes, menuFilters), [dishes, menuFilters])
  const recentDishes = useMemo(
    () => dishes.filter((dish) => dish.lastEatenAt).sort((a, b) => String(b.lastEatenAt).localeCompare(String(a.lastEatenAt))).slice(0, 5),
    [dishes],
  )
  const bothWantCount = dishes.filter((dish) => dish.preferences.personA === 'want' && dish.preferences.personB === 'want').length
  const headerSummary = `${dishes.length} 道菜 · ${bothWantCount} 道双方想吃 · ${hiddenAvoidCount} 道已避开`

  function showToast(message: string) {
    setToast(message)
  }

  function updateConditions(next: Partial<TodayConditions>) {
    setConditions((current) => ({ ...current, ...next }))
    setDecision({ stage: 'idle', dish: null, reasons: [] })
  }

  function resetConditions() {
    setConditions(defaultConditions)
    setDecision({ stage: 'idle', dish: null, reasons: [] })
    showToast('已回到默认条件')
  }

  function loosenConditions() {
    setConditions((current) => ({ ...current, companion: 'both', avoidMode: 'avoid', scene: 'any', speed: 'any' }))
    setDecision({ stage: 'idle', dish: null, reasons: [] })
    showToast('已放宽到日常推荐')
  }

  function rollDish() {
    if (todayDishes.length === 0) {
      setDecision({ stage: 'idle', dish: null, reasons: [] })
      setIsConditionOpen(true)
      showToast('这组条件下没有菜啦，可以放宽一点')
      return
    }
    setIsPicking(true)
    window.setTimeout(() => {
      const dish = pickWeightedDish(todayDishes, conditions) ?? todayDishes[0]
      setDecision({ stage: 'candidate', dish, reasons: buildReasons(dish, conditions) })
      setIsPicking(false)
    }, 420)
  }

  function confirmDecision(markEaten = false) {
    if (!decision.dish) return
    const dishId = decision.dish.id
    const now = new Date().toISOString()
    setDecision((current) => current.dish ? { ...current, stage: 'decided' } : current)
    if (markEaten) {
      setDishes((current) => current.map((dish) => dish.id === dishId ? { ...dish, lastEatenAt: now, updatedAt: now } : dish))
      showToast('已记为今晚吃过')
    } else {
      showToast('今晚就吃这个')
    }
  }

  function toggleFavorite(dishId: string) {
    setDishes((current) => current.map((dish) => dish.id === dishId ? { ...dish, favorite: !dish.favorite, updatedAt: new Date().toISOString() } : dish))
  }

  function setDishPreference(dishId: string, person: 'personA' | 'personB', preference: Preference) {
    setDishes((current) => current.map((dish) => dish.id === dishId ? {
      ...dish,
      preferences: { ...dish.preferences, [person]: preference },
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
      showToast('已保存修改')
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
      showToast('已加入小菜单')
    }
    setIsFormOpen(false)
    setEditingDish(null)
  }

  function deleteDish(dishId: string) {
    if (!window.confirm('确定要从小菜单里删除这道菜吗？')) return
    setDishes((current) => current.filter((dish) => dish.id !== dishId))
    if (decision.dish?.id === dishId) setDecision({ stage: 'idle', dish: null, reasons: [] })
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
        const parsed = parseDishArray(JSON.parse(String(reader.result)))
        if (parsed.length === 0) throw new Error('invalid')
        setDishes(parsed)
        setDecision({ stage: 'idle', dish: null, reasons: [] })
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
    setDecision({ stage: 'idle', dish: null, reasons: [] })
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
          <p>从你们的小菜单里选一个刚刚好。</p>
        </div>
        <div className="status-board" aria-label="菜单概览">
          <strong>{dishes.length} 道菜</strong>
          <span>{headerSummary}</span>
        </div>
      </header>

      <nav className="tab-bar" aria-label="主导航">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>今晚吃什么</button>
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>小菜单</button>
      </nav>

      {tab === 'today' ? (
        <TodayPage
          conditions={conditions}
          decision={decision}
          hiddenAvoidCount={hiddenAvoidCount}
          isConditionOpen={isConditionOpen}
          isPicking={isPicking}
          recentDishes={recentDishes}
          visibleCount={todayDishes.length}
          onConfirm={confirmDecision}
          onLoosen={loosenConditions}
          onOpenCreate={openCreateForm}
          onReset={resetConditions}
          onRoll={rollDish}
          onToggleCondition={() => setIsConditionOpen((current) => !current)}
          onUpdateConditions={updateConditions}
        />
      ) : (
        <MenuPage
          dishes={menuDishes}
          filters={menuFilters}
          totalCount={dishes.length}
          onCreate={openCreateForm}
          onEdit={openEditForm}
          onExport={exportData}
          onFavorite={toggleFavorite}
          onImport={importData}
          onReset={resetDemoData}
          onSetPreference={setDishPreference}
          onUpdateFilters={(next) => setMenuFilters((current) => ({ ...current, ...next }))}
          onResetFilters={() => setMenuFilters(defaultMenuFilters)}
        />
      )}

      {isFormOpen && <DishForm dish={editingDish} onClose={() => setIsFormOpen(false)} onSave={saveDish} onDelete={deleteDish} />}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </main>
  )
}

function TodayPage({ conditions, decision, hiddenAvoidCount, isConditionOpen, isPicking, recentDishes, visibleCount, onConfirm, onLoosen, onOpenCreate, onReset, onRoll, onToggleCondition, onUpdateConditions }: {
  conditions: TodayConditions
  decision: Decision
  hiddenAvoidCount: number
  isConditionOpen: boolean
  isPicking: boolean
  recentDishes: Dish[]
  visibleCount: number
  onConfirm: (markEaten?: boolean) => void
  onLoosen: () => void
  onOpenCreate: () => void
  onReset: () => void
  onRoll: () => void
  onToggleCondition: () => void
  onUpdateConditions: (next: Partial<TodayConditions>) => void
}) {
  return (
    <section className="today-stack">
      <DecisionCard decision={decision} isPicking={isPicking} visibleCount={visibleCount} onConfirm={onConfirm} onLoosen={onLoosen} onOpenCreate={onOpenCreate} onRoll={onRoll} />
      <ConditionSummary conditions={conditions} hiddenAvoidCount={hiddenAvoidCount} isOpen={isConditionOpen} visibleCount={visibleCount} onToggle={onToggleCondition} />
      {isConditionOpen && <ConditionPanel conditions={conditions} onReset={onReset} onUpdate={onUpdateConditions} />}
      <RecentCard dishes={recentDishes} />
    </section>
  )
}

function DecisionCard({ decision, isPicking, visibleCount, onConfirm, onLoosen, onOpenCreate, onRoll }: {
  decision: Decision
  isPicking: boolean
  visibleCount: number
  onConfirm: (markEaten?: boolean) => void
  onLoosen: () => void
  onOpenCreate: () => void
  onRoll: () => void
}) {
  if (!visibleCount) {
    return (
      <section className="panel decision-card empty-decision">
        <p className="eyebrow">今晚吃什么</p>
        <h2>这组条件下没有候选</h2>
        <p>可以放宽条件，或者先加一道常吃的。</p>
        <div className="button-row wrap">
          <button className="secondary-button" onClick={onLoosen}>放宽一点</button>
          <button className="ghost-button" onClick={onOpenCreate}>添加菜品</button>
        </div>
      </section>
    )
  }

  if (decision.stage === 'idle' || !decision.dish) {
    return (
      <section className="panel decision-card">
        <p className="eyebrow">今晚吃什么</p>
        <h2>{isPicking ? '正在翻菜单…' : '今晚想怎么吃？'}</h2>
        <p>我会先避开不想吃的菜，再从候选里挑一个。</p>
        <div className="decision-count">{visibleCount} 道候选</div>
        <button className="primary-button big-cta" onClick={onRoll} disabled={isPicking}>{isPicking ? '马上就好' : '帮我们选一个'}</button>
      </section>
    )
  }

  const dish = decision.dish
  const isDecided = decision.stage === 'decided'

  return (
    <section className={`panel decision-card result-card ${isDecided ? 'confirmed' : ''}`} aria-live="polite">
      <p className="eyebrow">{isDecided ? '已决定' : '候选中'}</p>
      <h2>{isDecided ? '今晚就吃' : '这次选到'}</h2>
      <strong>{dish.name}</strong>
      <ul>
        {decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <DishMeta dish={dish} />
      <div className="button-row wrap">
        {isDecided ? (
          <>
            <button className="primary-button" onClick={() => onConfirm(true)}>记为已吃</button>
            <button className="secondary-button" onClick={onRoll}>重新选择</button>
          </>
        ) : (
          <>
            <button className="primary-button" onClick={() => onConfirm(false)}>今晚就吃这个</button>
            <button className="secondary-button" onClick={onRoll}>换一个</button>
          </>
        )}
      </div>
    </section>
  )
}

function ConditionSummary({ conditions, hiddenAvoidCount, isOpen, visibleCount, onToggle }: {
  conditions: TodayConditions
  hiddenAvoidCount: number
  isOpen: boolean
  visibleCount: number
  onToggle: () => void
}) {
  return (
    <button className="condition-summary" onClick={onToggle} aria-expanded={isOpen}>
      <span>{visibleCount} 道候选</span>
      <span>{summarizeConditions(conditions, hiddenAvoidCount)}</span>
      <strong>{isOpen ? '收起条件' : '调整条件'}</strong>
    </button>
  )
}

function ConditionPanel({ conditions, onReset, onUpdate }: {
  conditions: TodayConditions
  onReset: () => void
  onUpdate: (next: Partial<TodayConditions>) => void
}) {
  return (
    <section className="panel condition-panel">
      <div className="section-heading compact">
        <span>🌿</span>
        <div>
          <h2>今晚的条件</h2>
          <p>用日常说法就好，不用精确筛选。</p>
        </div>
      </div>
      <SegmentedGroup label="照顾谁的口味" values={[['both', '我和 TA 都可以'], ['personA', '照顾我'], ['personB', '照顾 TA']]} active={conditions.companion} onChange={(value) => onUpdate({ companion: value as CompanionMode })} />
      <SegmentedGroup label="忌口策略" values={[['avoid', '避开任一方不想吃'], ['relaxed', '今晚先不管忌口']]} active={conditions.avoidMode} onChange={(value) => onUpdate({ avoidMode: value as AvoidMode })} />
      <SegmentedGroup label="吃饭场景" values={[['any', '都行'], ['home', '在家'], ['delivery', '外卖'], ['restaurant', '出门'], ['convenience', '便利店']]} active={conditions.scene} onChange={(value) => onUpdate({ scene: value as SceneMode })} />
      <SegmentedGroup label="时间" values={[['any', '都行'], ['quick', '快一点'], ['normal', '不着急']]} active={conditions.speed} onChange={(value) => onUpdate({ speed: value as SpeedMode })} />
      <button className="ghost-button" onClick={onReset}>清空条件</button>
    </section>
  )
}

function MenuPage({ dishes, filters, totalCount, onCreate, onEdit, onExport, onFavorite, onImport, onReset, onResetFilters, onSetPreference, onUpdateFilters }: {
  dishes: Dish[]
  filters: MenuFilters
  totalCount: number
  onCreate: () => void
  onEdit: (dish: Dish) => void
  onExport: () => void
  onFavorite: (dishId: string) => void
  onImport: (file: File | undefined) => void
  onReset: () => void
  onResetFilters: () => void
  onSetPreference: (dishId: string, person: 'personA' | 'personB', preference: Preference) => void
  onUpdateFilters: (next: Partial<MenuFilters>) => void
}) {
  return (
    <section className="menu-column">
      <div className="panel menu-toolbar">
        <div>
          <p className="eyebrow">菜单维护</p>
          <h2>小菜单</h2>
          <p>搜索、补充菜品，偏好会影响今晚推荐。</p>
        </div>
        <button className="primary-button" onClick={onCreate}>添加菜品</button>
      </div>

      <section className="panel maintenance-panel">
        <label className="field-label search-field">
          搜索菜品
          <input value={filters.search} onChange={(event) => onUpdateFilters({ search: event.target.value })} placeholder="搜菜名、口味、备注" />
        </label>
        <details>
          <summary>筛选列表</summary>
          <ChipGroup label="分类" values={['全部', ...categories]} active={filters.category} onChange={(value) => onUpdateFilters({ category: value })} />
          <ChipGroup label="特点" values={['全部', ...quickTags]} active={filters.tag} onChange={(value) => onUpdateFilters({ tag: value })} />
          <ChipGroup
            label="偏好"
            values={['all', 'bothWant', 'personAWant', 'personBWant', 'avoidOnly']}
            getLabel={(value) => ({ all: '全部', bothWant: '双方想吃', personAWant: '我想吃', personBWant: 'TA 想吃', avoidOnly: '有人不想吃' }[value] ?? value)}
            active={filters.preference}
            onChange={(value) => onUpdateFilters({ preference: value as MenuFilters['preference'] })}
          />
          <button className="ghost-button" onClick={onResetFilters}>重置列表筛选</button>
        </details>
        <details>
          <summary>数据管理</summary>
          <div className="button-row wrap tool-row">
            <button className="ghost-button" onClick={onExport}>导出 JSON</button>
            <label className="import-button">导入 JSON<input type="file" accept="application/json" onChange={(event) => onImport(event.target.files?.[0])} /></label>
            <button className="danger-button" onClick={onReset}>恢复示例</button>
          </div>
        </details>
      </section>

      <div className="list-summary">当前显示 {dishes.length} / {totalCount} 道菜</div>
      {dishes.length ? (
        <div className="dish-grid">
          {dishes.map((dish) => <DishCard key={dish.id} dish={dish} onEdit={onEdit} onFavorite={onFavorite} onSetPreference={onSetPreference} />)}
        </div>
      ) : (
        <div className="panel"><EmptyState title="菜单还是空的" text="先加一道你们常吃的吧。" action="添加第一道菜" onAction={onCreate} /></div>
      )}
    </section>
  )
}

function DishCard({ dish, onEdit, onFavorite, onSetPreference }: {
  dish: Dish
  onEdit: (dish: Dish) => void
  onFavorite: (dishId: string) => void
  onSetPreference: (dishId: string, person: 'personA' | 'personB', preference: Preference) => void
}) {
  return (
    <article className="dish-card">
      <div className="dish-card-top">
        <span className="category-badge">{dish.category}</span>
        <button className="icon-button" onClick={() => onFavorite(dish.id)} aria-label={dish.favorite ? '取消收藏' : '收藏'}>{dish.favorite ? '★' : '☆'}</button>
      </div>
      <h3>{dish.name}</h3>
      <DishMeta dish={dish} />
      <div className="pref-editor" aria-label="双方偏好">
        <PreferenceChoice label="我" value={dish.preferences.personA} onChange={(value) => onSetPreference(dish.id, 'personA', value)} />
        <PreferenceChoice label="TA" value={dish.preferences.personB} onChange={(value) => onSetPreference(dish.id, 'personB', value)} />
      </div>
      <p className="preference-hint">偏好会影响推荐权重，不是公开评分。</p>
      {dish.note && <p className="dish-note">{dish.note}</p>}
      <div className="dish-footer">
        <span>{dish.lastEatenAt ? `上次：${formatDate(dish.lastEatenAt)}` : '还没记录吃过'}</span>
        <button className="text-button" onClick={() => onEdit(dish)}>编辑</button>
      </div>
    </article>
  )
}

function PreferenceChoice({ label, value, onChange }: { label: string; value: Preference; onChange: (value: Preference) => void }) {
  return (
    <div className="preference-choice">
      <span>{label}</span>
      <div>
        {preferences.map((option) => (
          <button key={option} className={value === option ? `active ${option}` : ''} onClick={() => onChange(option)}>{preferenceLabels[option]}</button>
        ))}
      </div>
    </div>
  )
}

function RecentCard({ dishes }: { dishes: Dish[] }) {
  return (
    <section className="panel recent-card">
      <div className="section-heading compact">
        <span>🧺</span>
        <div>
          <h2>最近吃过</h2>
          <p>避免连续几天都抽到同一种。</p>
        </div>
      </div>
      <div className="recent-strip">
        {dishes.length ? dishes.map((dish) => <span key={dish.id}>{dish.name} · {formatDate(dish.lastEatenAt)}</span>) : <span>确认一次晚餐后，这里会出现记录。</span>}
      </div>
    </section>
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

function SegmentedGroup({ label, values, active, onChange }: {
  label: string
  values: [string, string][]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="segmented-group">
      <span>{label}</span>
      <div>
        {values.map(([value, text]) => <button key={value} className={active === value ? 'active' : ''} onClick={() => onChange(value)}>{text}</button>)}
      </div>
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
  const [showOptional, setShowOptional] = useState(Boolean(dish))

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
            <p className="eyebrow">{dish ? '编辑菜品' : '加一道常吃的'}</p>
            <h2>{dish ? '编辑菜品' : '放进小菜单'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">×</button>
        </div>

        <section className="form-section">
          <h3>基础信息</h3>
          <label className="field-label">菜名<input required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：番茄牛腩饭、楼下麻辣烫" /></label>
          <label className="field-label">怎么吃<select value={draft.sourceType} onChange={(event) => update('sourceType', event.target.value as SourceType)}>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="form-grid two">
            <label className="field-label">我的偏好<select value={draft.personA} onChange={(event) => update('personA', event.target.value as Preference)}>{Object.entries(preferenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field-label">TA 的偏好<select value={draft.personB} onChange={(event) => update('personB', event.target.value as Preference)}>{Object.entries(preferenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </section>

        <button type="button" className="ghost-button optional-toggle" onClick={() => setShowOptional((current) => !current)}>{showOptional ? '收起可选信息' : '补充可选信息'}</button>
        {showOptional && (
          <section className="form-section optional-section">
            <h3>可选信息</h3>
            <label className="field-label">分类<select value={draft.category} onChange={(event) => update('category', event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="field-label">特点<input value={draft.tagsText} onChange={(event) => update('tagsText', event.target.value)} placeholder="辣，快手，热乎" /></label>
            <div className="form-grid two">
              <label className="field-label">预算<select value={draft.budgetLevel} onChange={(event) => update('budgetLevel', event.target.value as BudgetLevel)}>{Object.entries(budgetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="field-label">时间<select value={draft.timeLevel} onChange={(event) => update('timeLevel', event.target.value as TimeLevel)}>{Object.entries(timeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label className="field-label">备注<textarea value={draft.note} onChange={(event) => update('note', event.target.value)} placeholder="店名、做法、忌口，或者你们的小暗号" /></label>
          </section>
        )}

        <div className="form-actions">
          {dish && <button type="button" className="danger-button" onClick={() => onDelete(dish.id)}>删除菜品</button>}
          <button type="button" className="ghost-button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit">{dish ? '保存修改' : '加入小菜单'}</button>
        </div>
      </form>
    </div>
  )
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><strong>{title}</strong><p>{text}</p><button className="primary-button" onClick={onAction}>{action}</button></div>
}

function loadDishes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaultDishes
    const parsed = parseDishArray(JSON.parse(stored))
    return parsed.length > 0 ? parsed : defaultDishes
  } catch {
    return defaultDishes
  }
}

function parseDishArray(value: unknown): Dish[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeDish).filter((dish): dish is Dish => dish !== null)
}

function normalizeDish(value: unknown): Dish | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) return null
  const preferencesRecord = isRecord(value.preferences) ? value.preferences : {}
  const now = new Date().toISOString()
  const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean) : []
  const lastEatenAt = typeof value.lastEatenAt === 'string' && !Number.isNaN(Date.parse(value.lastEatenAt)) ? value.lastEatenAt : undefined
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    name: value.name.trim(),
    category: typeof value.category === 'string' && value.category.trim() ? value.category.trim() : '家常',
    tags,
    sourceType: isSourceType(value.sourceType) ? value.sourceType : 'home',
    budgetLevel: isBudgetLevel(value.budgetLevel) ? value.budgetLevel : 'medium',
    timeLevel: isTimeLevel(value.timeLevel) ? value.timeLevel : 'normal',
    note: typeof value.note === 'string' ? value.note : '',
    preferences: {
      personA: isPreference(preferencesRecord.personA) ? preferencesRecord.personA : 'neutral',
      personB: isPreference(preferencesRecord.personB) ? preferencesRecord.personB : 'neutral',
    },
    favorite: typeof value.favorite === 'boolean' ? value.favorite : false,
    lastEatenAt,
    createdAt: typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt)) ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt)) ? value.updatedAt : now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSourceType(value: unknown): value is SourceType {
  return typeof value === 'string' && sourceTypes.includes(value as SourceType)
}

function isBudgetLevel(value: unknown): value is BudgetLevel {
  return typeof value === 'string' && budgetLevels.includes(value as BudgetLevel)
}

function isTimeLevel(value: unknown): value is TimeLevel {
  return typeof value === 'string' && timeLevels.includes(value as TimeLevel)
}

function isPreference(value: unknown): value is Preference {
  return typeof value === 'string' && preferences.includes(value as Preference)
}

function filterTodayDishes(dishes: Dish[], conditions: TodayConditions) {
  return dishes.filter((dish) => {
    const { personA, personB } = dish.preferences
    const respectsAvoid = conditions.avoidMode === 'relaxed' || (personA !== 'avoid' && personB !== 'avoid')
    const matchesCompanion = conditions.companion === 'both' || dish.preferences[conditions.companion] !== 'avoid'
    const matchesScene = conditions.scene === 'any' || dish.sourceType === conditions.scene
    const matchesSpeed = conditions.speed === 'any' || (conditions.speed === 'quick' ? dish.timeLevel === 'quick' : dish.timeLevel !== 'quick')
    return respectsAvoid && matchesCompanion && matchesScene && matchesSpeed
  })
}

function filterMenuDishes(dishes: Dish[], filters: MenuFilters) {
  const keyword = filters.search.trim().toLowerCase()
  return dishes.filter((dish) => {
    const matchesSearch = !keyword || [dish.name, dish.category, dish.note, ...dish.tags].some((item) => item.toLowerCase().includes(keyword))
    const matchesCategory = filters.category === '全部' || dish.category === filters.category
    const matchesTag = filters.tag === '全部' || dish.tags.includes(filters.tag) || sourceLabels[dish.sourceType] === filters.tag || timeLabels[dish.timeLevel] === filters.tag || budgetLabels[dish.budgetLevel] === filters.tag
    const { personA, personB } = dish.preferences
    const matchesPreference =
      filters.preference === 'all' ||
      (filters.preference === 'bothWant' && personA === 'want' && personB === 'want') ||
      (filters.preference === 'personAWant' && personA === 'want') ||
      (filters.preference === 'personBWant' && personB === 'want') ||
      (filters.preference === 'avoidOnly' && (personA === 'avoid' || personB === 'avoid'))
    return matchesSearch && matchesCategory && matchesTag && matchesPreference
  })
}

function pickWeightedDish(dishes: Dish[], conditions: TodayConditions) {
  if (dishes.length === 0) return null
  const pool = dishes.flatMap((dish) => Array.from({ length: Math.max(1, scoreDish(dish, conditions)) }, () => dish))
  return pool[Math.floor(Math.random() * pool.length)]
}

function scoreDish(dish: Dish, conditions: TodayConditions) {
  let score = 5
  const { personA, personB } = dish.preferences
  if (personA === 'want' && personB === 'want') score += 5
  else if (personA === 'want' || personB === 'want') score += 2
  if (conditions.companion !== 'both' && dish.preferences[conditions.companion] === 'want') score += 3
  if (personA === 'avoid' || personB === 'avoid') score -= 3
  if (conditions.speed === 'quick' && dish.timeLevel === 'quick') score += 2
  if (dish.favorite) score += 1
  if (dish.lastEatenAt) {
    const days = (Date.now() - new Date(dish.lastEatenAt).getTime()) / 86400000
    if (days < 3) score -= 4
    else if (days < 7) score -= 2
  }
  return score
}

function buildReasons(dish: Dish, conditions: TodayConditions) {
  const reasons: string[] = []
  if (dish.preferences.personA === 'want' && dish.preferences.personB === 'want') reasons.push('你们都标记过想吃')
  else if (dish.preferences.personA === 'want') reasons.push('更照顾你的口味')
  else if (dish.preferences.personB === 'want') reasons.push('更照顾 TA 的口味')
  if (!dish.lastEatenAt) reasons.push('最近还没吃过')
  else {
    const days = Math.max(1, Math.floor((Date.now() - new Date(dish.lastEatenAt).getTime()) / 86400000))
    reasons.push(`${days} 天没吃过了`)
  }
  if (conditions.scene !== 'any') reasons.push(`适合${sourceLabels[dish.sourceType]}`)
  if (dish.timeLevel === 'quick') reasons.push('快一点也能吃好')
  if (dish.budgetLevel === 'low') reasons.push('预算友好')
  return reasons.slice(0, 3)
}

function summarizeConditions(conditions: TodayConditions, hiddenAvoidCount: number) {
  const parts = [
    conditions.avoidMode === 'avoid' ? `避开不想吃${hiddenAvoidCount ? ` ${hiddenAvoidCount} 道` : ''}` : '先不管忌口',
    conditions.scene === 'any' ? '场景都行' : sourceLabels[conditions.scene],
    conditions.speed === 'any' ? '时间都行' : conditions.speed === 'quick' ? '快一点' : '不着急',
  ]
  if (conditions.companion === 'personA') parts.unshift('照顾我')
  if (conditions.companion === 'personB') parts.unshift('照顾 TA')
  return parts.join(' · ')
}

function formatDate(value?: string) {
  if (!value) return '未知'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(value))
}

export default App
