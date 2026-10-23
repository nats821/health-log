import { useEffect, useState } from 'react';
import { ChartIcon, GearIcon, HomeIcon, MoonIcon, SunIcon } from './components/Icons';
import { IS_DEMO, requestPersistence } from './db';
import { seedDemoIfEmpty } from './demo';
import Evening from './screens/Evening';
import Graph from './screens/Graph';
import Home from './screens/Home';
import Morning from './screens/Morning';
import SettingsScreen from './screens/Settings';

export type Screen = 'home' | 'morning' | 'evening' | 'graph' | 'settings';

const TABS: { id: Screen; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'ホーム', icon: <HomeIcon /> },
  { id: 'morning', label: '朝', icon: <SunIcon /> },
  { id: 'evening', label: '夜', icon: <MoonIcon /> },
  { id: 'graph', label: 'グラフ', icon: <ChartIcon /> },
  { id: 'settings', label: '設定', icon: <GearIcon /> },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (IS_DEMO) seedDemoIfEmpty();
    else requestPersistence();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };
  const saved = (msg: string) => {
    notify(msg);
    setScreen('home');
  };

  return (
    <div className="app">
      {IS_DEMO && <div className="demo-banner">デモ表示中（サンプル値・実データとは別保存）</div>}
      <main className="main">
        {screen === 'home' && <Home go={setScreen} />}
        {screen === 'morning' && <Morning onSaved={() => saved('朝の記録を保存しました')} />}
        {screen === 'evening' && <Evening onSaved={() => saved('夜の記録を保存しました')} />}
        {screen === 'graph' && <Graph />}
        {screen === 'settings' && <SettingsScreen notify={notify} />}
      </main>
      {toast && <div className="toast">{toast}</div>}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={screen === t.id ? 'on' : ''} onClick={() => setScreen(t.id)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
