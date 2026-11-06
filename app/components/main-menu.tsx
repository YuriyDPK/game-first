"use client";

import { useEffect, useRef, useState } from "react";
import { AudioManager, DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "@/lib/audio/audio-manager";
import { AUDIO_CUES } from "@/lib/audio/cues";
import { TrainMap } from "./train-map";

type Panel = "letter" | "journey" | "settings" | null;

function Ornament() {
  return <span className="ornament" aria-hidden="true"><i />✦<i /></span>;
}

export function MainMenu() {
  const [panel, setPanel] = useState<Panel>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [showTrain, setShowTrain] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [musicStatus, setMusicStatus] = useState("Музыка не подключена");
  const [audioStatus, setAudioStatus] = useState("");
  const audioRef = useRef<AudioManager | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new AudioManager();
      audioRef.current.setSettings(audioSettings);
    }
    return audioRef.current;
  }
  useEffect(() => () => { audioRef.current?.dispose(); audioRef.current = null; }, []);
  function updateAudio(key: keyof AudioSettings, value: number) {
    const next = { ...audioSettings, [key]: value };
    setAudioSettings(next);
    getAudio().setSettings(next);
  }
  async function openTrain() {
    setPanel(null);
    setShowTrain(true);
    setAudioStatus("");
    try { await getAudio().startTrainAmbience(); }
    catch { setAudioStatus("Звук окружения недоступен в этом браузере."); }
  }
  function exitTrain() {
    audioRef.current?.stopTrainAmbience();
    setShowTrain(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  }
  function playCue(id: string) {
    const cue = AUDIO_CUES[id];
    if (cue) void getAudio().playClip(cue.url, cue.channel);
  }
  async function selectMusic(file: File | undefined) {
    if (!file) return;
    try { await getAudio().loadMusic(file); setMusicStatus(`Играет: ${file.name}`); }
    catch { setMusicStatus("Не удалось воспроизвести файл. Попробуйте другой аудиоформат."); }
  }

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!panel) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        requestAnimationFrame(() => openerRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  function openPanel(next: Exclude<Panel, null>) {
    openerRef.current = document.activeElement as HTMLElement;
    setPanel(next);
  }
  function closePanel() {
    setPanel(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }
  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError("Полноэкранный режим недоступен в этом браузере.");
    }
  }

  return (
    <main className="game-shell">
      <div className="scene" aria-hidden="true" />
      <div className="scene-shade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div inert={showTrain}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✧</span><span>WIZARDING WORLD <b>FAN PROJECT</b></span></div>
        <div className="top-right"><span className="top-status"><span className="status-dot" /> ФАНАТСКИЙ ПРОТОТИП</span><button className="top-control" onClick={() => openPanel("settings")} aria-label="Открыть настройки">⚙ <span>НАСТРОЙКИ</span></button><button className="top-control fullscreen-control" onClick={toggleFullscreen} aria-label={fullscreen ? "Выйти из полного экрана" : "Полный экран"} aria-pressed={fullscreen}><span aria-hidden="true">⛶</span><span className="control-label">{fullscreen ? "СВЕРНУТЬ" : "ПОЛНЫЙ ЭКРАН"}</span></button></div>
      </header>

      <section className="hero" aria-labelledby="game-title">
        <div className="eyebrow"><span /> ВАША ИСТОРИЯ ВОЛШЕБСТВА <span /></div>
        <p className="harry-potter">HARRY POTTER</p>
        <h1 id="game-title">HOGWARTS<br /><em>ONLINE</em></h1>
        <Ornament />
        <p className="hero-copy">Письмо пришло. Приключение ждёт.<br />Добро пожаловать домой.</p>
        <div className="menu-actions">
          <button className="primary-button" onClick={() => openPanel("letter")}><span className="button-spark">✦</span> НАЧАТЬ ИСТОРИЮ <span className="arrow">→</span></button>
          <button className="secondary-button" onClick={() => openPanel("journey")}><span className="button-icon">◇</span> ПУТЬ ВПЕРЕДИ <span className="arrow">→</span></button>
        </div>
        <p className="menu-note">ВАШЕ ПРИКЛЮЧЕНИЕ ТОЛЬКО НАЧИНАЕТСЯ</p>
      </section>

      <aside className="chapter-card"><div className="chapter-number">01 <span>/ 10</span></div><div className="chapter-line" /><div><span className="chapter-label">ПЕРВАЯ ГЛАВА</span><strong>Письмо из Хогвартса</strong><small>Ваша история начинается здесь</small></div></aside>
      <div className="location"><span className="location-icon">✧</span><div><small>ШОТЛАНДИЯ, ВЕЛИКОБРИТАНИЯ</small><strong>Хогвартс</strong></div></div>
      <footer className="bottom-bar"><span>СОЗДАНО ПОКЛОННИКАМИ МАГИИ <span className="footer-star">✦</span> НЕОФИЦИАЛЬНЫЙ ФАНАТСКИЙ ПРОЕКТ</span></footer>
      </div>
      {fullscreenError && <p className="top-error" role="status">{fullscreenError}</p>}
      {showTrain && <TrainMap onExit={exitTrain} onInteract={playCue} onSettings={() => openPanel("settings")} onFullscreen={toggleFullscreen} fullscreen={fullscreen} audioStatus={audioStatus} />}

      {panel && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="panel-title">
          <button ref={closeRef} className="close-button" onClick={closePanel} aria-label="Закрыть">×</button>
          {panel === "letter" && <div className="letter-content"><div className="seal">H</div><p className="modal-kicker">ШКОЛА ЧАРОДЕЙСТВА И ВОЛШЕБСТВА</p><h2 id="panel-title">Хогвартс</h2><Ornament /><p className="letter-greeting">Дорогой будущий ученик!</p><p>Рады сообщить вам, что вы зачислены в Школу чародейства и волшебства Хогвартс.</p><p>Впереди вас ждут новые друзья, невероятные открытия и история, которую вы напишете сами.</p><p className="letter-signature">С нетерпением ждём встречи,<br /><em>Хогвартс</em></p><button className="primary-button modal-action" onClick={() => setPanel("journey")}>ПРОДОЛЖИТЬ <span className="arrow">→</span></button></div>}
          {panel === "journey" && <div><p className="modal-kicker">КАЖДОЕ ПРИКЛЮЧЕНИЕ С ЧЕГО-ТО НАЧИНАЕТСЯ</p><h2 id="panel-title">Путь впереди</h2><p className="modal-intro">Мы только открываем двери в этот мир. Вот что ждёт вас в следующих главах разработки.</p><div className="journey-list"><div><span>01</span><section><strong>Письмо из Хогвартса</strong><small>Ваше приглашение уже здесь</small></section><b>ДОСТУПНО</b></div><div><span>02</span><section><strong>Создание персонажа</strong><small>Создайте собственную историю</small></section><b>В РАЗРАБОТКЕ</b></div><div><span>03</span><section><strong>Встреча с друзьями</strong><small>Совместное путешествие в Хогвартс</small></section><b>ВПЕРЕДИ</b></div></div><p className="availability">Создание персонажа и сетевое лобби пока недоступны. Прогресс на этом этапе не сохраняется.</p><button className="primary-button" onClick={openTrain}>✦ &nbsp; ИССЛЕДОВАТЬ ВАГОН <span className="arrow">→</span></button><button className="text-button" onClick={closePanel}>← ВЕРНУТЬСЯ В МЕНЮ</button></div>}
          {panel === "settings" && <div><p className="modal-kicker">СДЕЛАЙТЕ ЭТОТ МИР СВОИМ</p><h2 id="panel-title">Настройки звука</h2><p className="modal-intro">Громкость действует в текущем сеансе.</p><div className="volume-list">{([ ["master", "Общая громкость"], ["music", "Музыка"], ["ambience", "Окружение"], ["voice", "Голоса"], ["effects", "Эффекты"] ] as const).map(([key, label]) => <label className="volume-row" key={key}><span>{label}</span><input type="range" min="0" max="100" value={Math.round(audioSettings[key] * 100)} onChange={event => updateAudio(key, Number(event.target.value) / 100)} /><output>{Math.round(audioSettings[key] * 100)}%</output></label>)}</div><div className="music-upload"><strong>Музыка для меню</strong><p>Выберите свой аудиофайл, на использование которого у вас есть права. Файл остаётся в браузере до закрытия страницы.</p><label className="upload-button">ВЫБРАТЬ АУДИОФАЙЛ<input type="file" accept="audio/*" onChange={event => { void selectMusic(event.target.files?.[0]); event.target.value = ""; }} /></label><p role="status">{musicStatus}</p></div><p className="availability">Окружение вагона синтезируется браузером. Озвучка и эффекты появятся после добавления аудиофайлов.</p><button className="text-button" onClick={closePanel}>← НАЗАД</button></div>}
        </section>
      </div>}
    </main>
  );
}
