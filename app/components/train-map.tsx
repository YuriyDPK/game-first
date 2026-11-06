"use client";

import { useEffect, useState } from "react";
import { isWalkable, nearbyInteraction, TRAIN_INTERACTIONS, TRAIN_SIZE, TRAIN_SPAWN, type Point } from "@/lib/game/train-map";

type Props = { onExit: () => void; onInteract: (cue: string) => void; onSettings: () => void; onFullscreen: () => void; fullscreen: boolean; audioStatus: string };
export function TrainMap({ onExit, onInteract, onSettings, onFullscreen, fullscreen, audioStatus }: Props) {
  const [player, setPlayer] = useState<Point>(TRAIN_SPAWN);
  const [message, setMessage] = useState("Вы в начале вагона. Исследуйте купе и подойдите к отмеченным предметам.");
  const nearby = nearbyInteraction(player);
  function move(dx: number, dy: number) {
    setPlayer(current => { const next = { x: current.x + dx, y: current.y + dy }; return isWalkable(next) ? next : current; });
  }
  function interact() {
    if (!nearby) { setMessage("Подойдите ближе к отмеченному предмету."); return; }
    setMessage(nearby.description);
    onInteract(nearby.cue);
  }
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const key = event.key.toLowerCase();
      const directions: Record<string, [number, number]> = { arrowup: [0, -1], w: [0, -1], ц: [0, -1], arrowdown: [0, 1], s: [0, 1], ы: [0, 1], arrowleft: [-1, 0], a: [-1, 0], ф: [-1, 0], arrowright: [1, 0], d: [1, 0], в: [1, 0] };
      if (directions[key]) { event.preventDefault(); move(...directions[key]); }
      else if (key === "e" || key === "у") { event.preventDefault(); interact(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });
  return <main className="train-screen">
    <header className="train-header"><div><span className="train-kicker">ХОГВАРТС-ЭКСПРЕСС · ПЕРВЫЙ ПРОТОТИП</span><h1>Вагон поезда</h1></div><div className="train-header-actions"><button className="top-control" onClick={onSettings}>⚙ НАСТРОЙКИ</button><button className="top-control" onClick={onFullscreen} aria-label={fullscreen ? "Выйти из полного экрана" : "Полный экран"}>⛶</button><button className="top-control" onClick={onExit}>← В МЕНЮ</button></div></header>
    <div className="train-layout"><section className="train-main"><div className="train-title"><div><span>СХЕМА ЛОКАЦИИ</span><h2>В пути в Хогвартс</h2></div><span className="prototype-badge">2D ПРОТОТИП</span></div>
      <p className="train-lead">Исследуйте схему вагона: пройдите по коридору и загляните в купе.</p>
      <div className="train-map" role="img" aria-label={`Схема вагона. Ваше положение: колонка ${player.x}, ряд ${player.y}.`}>
        {Array.from({ length: TRAIN_SIZE.width * TRAIN_SIZE.height }, (_, index) => {
          const point = { x: index % TRAIN_SIZE.width, y: Math.floor(index / TRAIN_SIZE.width) };
          const wall = !isWalkable(point); const selected = point.x === player.x && point.y === player.y;
          const item = TRAIN_INTERACTIONS.find(it => it.position.x === point.x && it.position.y === point.y);
          return <div key={index} className={`map-cell ${wall ? "wall" : point.y === 4 ? "corridor" : "compartment"} ${item ? "has-item" : ""}`} aria-hidden="true">{item && <span className="map-item" title={item.title}>✦</span>}{selected && <span className="map-player">●</span>}</div>;
        })}
      </div>
      <div className="map-legend"><span><i className="legend-player" /> ВЫ</span><span><i className="legend-item" /> МОЖНО ИССЛЕДОВАТЬ</span><span>WASD / СТРЕЛКИ · E — ДЕЙСТВИЕ</span></div>
      <div className="mobile-controls" aria-label="Управление перемещением"><button onClick={() => move(0, -1)} aria-label="Вверх">↑</button><div><button onClick={() => move(-1, 0)} aria-label="Влево">←</button><button onClick={() => move(0, 1)} aria-label="Вниз">↓</button><button onClick={() => move(1, 0)} aria-label="Вправо">→</button></div></div>
    </section><aside className="train-side"><span className="train-kicker">ВАШЕ ПУТЕШЕСТВИЕ</span><h2>Первый шаг</h2><p>Поезд уже отправился с платформы 9¾. Впереди — ваша первая встреча с волшебным миром.</p><div className="train-divider" /><span className="train-kicker">РЯДОМ</span><h3>{nearby?.title ?? "Коридор вагона"}</h3><p aria-live="polite">{message}</p><button className="primary-button" onClick={interact}>✦ &nbsp; {nearby ? "ОСМОТРЕТЬ" : "ИСКАТЬ РЯДОМ"}</button>{audioStatus && <p className="error" role="status">{audioStatus}</p>}<p className="prototype-note">Это интерактивная схема, не готовая 3D-сцена. Сохранения и другие игроки пока не подключены.</p></aside></div>
  </main>;
}
