import { useEffect, useState } from 'react';
import { CalendarIcon, ChartIcon, DumbbellIcon, GearIcon, HomeIcon } from './components/Icons';
import { IS_DEMO, requestPersistence } from './db';
import { seedDemoIfEmpty } from './demo';
import CalendarScreen from './screens/Calendar';
import Evening from './screens/Evening';
import Exercise from './screens/Exercise';
import Graph from './screens/Graph';
import Home from './screens/Home';
import Import from './screens/Import';
import Monthly from './screens/Monthly';
import Morning from './screens/Morning';
import Photos from './screens/Photos';
import SettingsScreen from './screens/Settings';

export type Screen = 'home' | 'morning' | 'evening' | 'calendar' | 'exercise' | 'monthly' | 'graph' | 'settings' | 'import' | 'photos';
export type Go = (screen: Screen, date?: string) => void;

const TABS: { id: Screen; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'ホーム', icon: <HomeIcon /> },
  { id: 'calendar', label: 'カレンダー', icon: <CalendarIcon /> },
  { id: 'exercise', label: '運動', icon: <DumbbellIcon /> },
  { id: 'graph', label: 'グラフ', icon: <ChartIcon /> },
  { id: 'settings', label: '設定', icon: <GearIcon /> },
];

// 朝・夜・月次はホームやカレンダーから開く画面。タブはどこを光らせるか
const TAB_OF: Partial<Record<Screen, Screen>> = { morning: 'home', evening: 'home', monthly: 'home', import: 'settings', photos: 'home' };

export default function App() {
  const [nav, setNav] = useState<{ screen: Screen; date?: string; key: number }>({ screen: 'home', key: 0 });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEMO) seedDemoIfEmpty();
    else requestPersistence();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [nav]);

  const go: Go = (screen, date) => setNav((n) => ({ screen, date, key: n.key + 1 }));
  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };
  const saved = (msg: string) => {
    notify(msg);
    go('home');
  };

  const { screen, date, key } = nav;
  const activeTab = TAB_OF[screen] ?? screen;

  return (
    <div className="app">
      {IS_DEMO && <div className="demo-banner">デモ表示中（サンプル値・実データとは別保存）</div>}
      <main className="main" key={key}>
        {screen === 'home' && <Home go={go} />}
        {screen === 'morning' && <Morning initialDate={date} onSaved={() => saved('朝の記録を保存しました')} />}
        {screen === 'evening' && <Evening initialDate={date} go={go} onSaved={() => saved('夜の記録を保存しました')} />}
        {screen === 'calendar' && <CalendarScreen go={go} initialDate={date} />}
        {screen === 'exercise' && <Exercise initialDate={date} notify={notify} />}
        {screen === 'monthly' && <Monthly initialDate={date} go={go} notify={notify} />}
        {screen === 'photos' && <Photos initialDate={date} notify={notify} />}
        {screen === 'graph' && <Graph />}
        {screen === 'settings' && <SettingsScreen go={go} notify={notify} />}
        {screen === 'import' && <Import go={go} notify={notify} />}
      </main>
      {toast && <div className="toast">{toast}</div>}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={activeTab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
