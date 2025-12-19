
import { GoogleGenAI } from "@google/genai";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Constants from './constants';
import { GameStatus, Obstacle, Planet, Star, Treat } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [treatCount, setTreatCount] = useState(0);
  const [catY, setCatY] = useState(Constants.GROUND_Y - Constants.CAT_SIZE);
  const [velocity, setVelocity] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [treats, setTreats] = useState<Treat[]>([]);
  const [gameSpeed, setGameSpeed] = useState(Constants.INITIAL_OBSTACLE_SPEED);
  const [cosmicQuote, setCosmicQuote] = useState("Kiki is ready for take-off!");
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const groundOffsetRef = useRef(0);

  // Initialize stars and planets
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * Constants.GAME_WIDTH,
        y: Math.random() * (Constants.GROUND_Y - 50),
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.4 + 0.1
      });
    }
    starsRef.current = stars;

    const planets: Planet[] = [
      { x: 100, y: 50, size: 40, color: Constants.COLORS.planet1, speed: 0.1, opacity: 0.6 },
      { x: 400, y: 120, size: 60, color: Constants.COLORS.planet2, speed: 0.05, opacity: 0.4 },
      { x: 550, y: 80, size: 25, color: Constants.COLORS.planet3, speed: 0.15, opacity: 0.5 }
    ];
    planetsRef.current = planets;
  }, []);

  const fetchCosmicQuote = async () => {
    setIsLoadingQuote(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Give me a very short (max 8 words) funny encouraging phrase for a ginger cat named Kiki who is traveling through space and collecting fish treats.",
        config: { temperature: 1.0 }
      });
      setCosmicQuote(response.text?.trim() || "Kiki's whiskers are twitching for victory!");
    } catch (error) {
      setCosmicQuote("You're a star-born hunter, Kiki!");
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const resetGame = () => {
    setCatY(Constants.GROUND_Y - Constants.CAT_SIZE);
    setVelocity(0);
    setScore(0);
    setTreatCount(0);
    setObstacles([]);
    setTreats([]);
    setGameSpeed(Constants.INITIAL_OBSTACLE_SPEED);
    setStatus(GameStatus.PLAYING);
  };

  const handleJump = useCallback(() => {
    const isOnGround = catY >= Constants.GROUND_Y - Constants.CAT_SIZE - 2;
    if (status === GameStatus.PLAYING && isOnGround) {
      setVelocity(Constants.JUMP_STRENGTH);
    } else if (status === GameStatus.START || status === GameStatus.GAME_OVER) {
      resetGame();
    }
  }, [status, catY]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  const update = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) {
      draw();
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    // Physics
    let newVelocity = velocity + Constants.GRAVITY;
    let newCatY = catY + newVelocity;

    // Ground collision
    if (newCatY > Constants.GROUND_Y - Constants.CAT_SIZE) {
      newCatY = Constants.GROUND_Y - Constants.CAT_SIZE;
      newVelocity = 0;
    }

    setVelocity(newVelocity);
    setCatY(newCatY);
    
    // Increase speed and score
    setGameSpeed(s => s + Constants.SPEED_INCREMENT);
    setScore(s => s + 1);

    const catBox = { x: Constants.CAT_X + 10, y: newCatY + 5, w: Constants.CAT_SIZE - 20, h: Constants.CAT_SIZE - 10 };

    // Obstacles
    setObstacles(prev => {
      let next = prev.map(o => ({ ...o, x: o.x - gameSpeed }));
      next = next.filter(o => o.x > -100);

      const lastObstacle = next[next.length - 1];
      if (!lastObstacle || lastObstacle.x < Constants.GAME_WIDTH - (Math.random() * 200 + 350)) {
        const height = Math.random() * 40 + 40; 
        const width = Math.random() * 30 + 30;
        next.push({
          id: Date.now(),
          x: Constants.GAME_WIDTH + 50,
          width,
          height,
          type: Math.random() > 0.5 ? 'asteroid' : 'dustCloud',
          color: Math.random() > 0.5 ? '#64748b' : '#475569'
        });
      }

      // Check Collision with Obstacles
      for (const o of next) {
        const obBox = { x: o.x + 5, y: Constants.GROUND_Y - o.height + 5, w: o.width - 10, h: o.height - 5 };
        if (catBox.x < obBox.x + obBox.w &&
            catBox.x + catBox.w > obBox.x &&
            catBox.y < obBox.y + obBox.h &&
            catBox.y + catBox.h > obBox.y) {
          setStatus(GameStatus.GAME_OVER);
          setHighScore(h => Math.max(h, Math.floor(score / 10)));
          fetchCosmicQuote();
        }
      }

      return next;
    });

    // Treats
    setTreats(prev => {
      let next = prev.map(t => ({ ...t, x: t.x - gameSpeed }));
      next = next.filter(t => t.x > -50 && !t.collected);

      // Spawn treats
      if (Math.random() < 0.015 && next.length < 3) {
        next.push({
          id: Date.now() + Math.random(),
          x: Constants.GAME_WIDTH + 50,
          y: Constants.GROUND_Y - 80 - Math.random() * 100, // Float in the air
          size: Constants.TREAT_SIZE,
          collected: false
        });
      }

      // Collision detection for treats
      next.forEach(t => {
        if (!t.collected) {
          const treatBox = { x: t.x, y: t.y, w: t.size, h: t.size };
          if (catBox.x < treatBox.x + treatBox.w &&
              catBox.x + catBox.w > treatBox.x &&
              catBox.y < treatBox.y + treatBox.h &&
              catBox.y + catBox.h > treatBox.y) {
            t.collected = true;
            setTreatCount(c => c + 1);
          }
        }
      });

      return next;
    });

    groundOffsetRef.current = (groundOffsetRef.current + gameSpeed) % 60;

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [status, catY, velocity, gameSpeed, score]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = Constants.COLORS.space;
    ctx.fillRect(0, 0, Constants.GAME_WIDTH, Constants.GAME_HEIGHT);

    // Planets
    planetsRef.current.forEach(p => {
      p.x -= p.speed * (status === GameStatus.PLAYING ? gameSpeed : 1);
      if (p.x < -p.size * 2) p.x = Constants.GAME_WIDTH + p.size * 2;
      
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      if (p.size > 50) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 1.5, p.size * 0.3, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });

    // Stars
    starsRef.current.forEach(star => {
      star.x -= star.speed * (status === GameStatus.PLAYING ? gameSpeed * 0.2 : 1);
      if (star.x < 0) star.x = Constants.GAME_WIDTH;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Ground
    const groundGradient = ctx.createLinearGradient(0, Constants.GROUND_Y, 0, Constants.GAME_HEIGHT);
    groundGradient.addColorStop(0, Constants.COLORS.ground);
    groundGradient.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, Constants.GROUND_Y, Constants.GAME_WIDTH, Constants.GAME_HEIGHT - Constants.GROUND_Y);
    
    ctx.strokeStyle = Constants.COLORS.groundLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, Constants.GROUND_Y);
    ctx.lineTo(Constants.GAME_WIDTH, Constants.GROUND_Y);
    ctx.stroke();

    for (let i = -60; i < Constants.GAME_WIDTH + 60; i += 60) {
      ctx.strokeStyle = '#5b21b6';
      ctx.beginPath();
      ctx.moveTo(i - groundOffsetRef.current, Constants.GROUND_Y + 15);
      ctx.lineTo(i - groundOffsetRef.current + 30, Constants.GROUND_Y + 15);
      ctx.stroke();
    }

    // Treats - Golden Fish
    treats.forEach(t => {
      if (t.collected) return;
      ctx.save();
      ctx.translate(t.x + t.size / 2, t.y + t.size / 2);
      
      // Hover animation
      const hover = Math.sin(Date.now() * 0.005 + t.id) * 5;
      ctx.translate(0, hover);

      ctx.fillStyle = Constants.COLORS.treat;
      ctx.shadowBlur = 15;
      ctx.shadowColor = Constants.COLORS.treatGlow;
      
      // Draw fish shape
      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, t.size * 0.4, t.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(-t.size * 0.3, 0);
      ctx.lineTo(-t.size * 0.55, -t.size * 0.2);
      ctx.lineTo(-t.size * 0.55, t.size * 0.2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(t.size * 0.2, -t.size * 0.05, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Obstacles - Dramatic Asteroids
    obstacles.forEach(o => {
      ctx.fillStyle = o.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = Constants.COLORS.asteroidGlow;
      
      if (o.type === 'asteroid') {
        ctx.beginPath();
        ctx.moveTo(o.x, Constants.GROUND_Y);
        ctx.lineTo(o.x + o.width * 0.2, Constants.GROUND_Y - o.height * 0.8);
        ctx.lineTo(o.x + o.width * 0.5, Constants.GROUND_Y - o.height);
        ctx.lineTo(o.x + o.width * 0.8, Constants.GROUND_Y - o.height * 0.7);
        ctx.lineTo(o.x + o.width, Constants.GROUND_Y);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(o.x + o.width * 0.4, Constants.GROUND_Y - o.height * 0.5, o.width * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(o.x + o.width/2, Constants.GROUND_Y - o.height/2, o.width/2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    });

    // Kiki the Ginger Cat
    ctx.save();
    ctx.translate(Constants.CAT_X + Constants.CAT_SIZE/2, catY + Constants.CAT_SIZE/2);
    
    if (velocity !== 0) {
      ctx.rotate(velocity * 0.04);
    } else if (status === GameStatus.PLAYING) {
      ctx.rotate(Math.sin(Date.now() * 0.015) * 0.08);
    }

    ctx.fillStyle = Constants.COLORS.cat;
    ctx.beginPath();
    ctx.ellipse(0, 5, Constants.CAT_SIZE/2, Constants.CAT_SIZE/2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(Constants.CAT_SIZE/4, -Constants.CAT_SIZE/6, Constants.CAT_SIZE/3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = Constants.COLORS.cat;
    ctx.beginPath();
    ctx.moveTo(Constants.CAT_SIZE/8, -Constants.CAT_SIZE/2.5);
    ctx.lineTo(Constants.CAT_SIZE/4, -Constants.CAT_SIZE/1.5);
    ctx.lineTo(Constants.CAT_SIZE/2, -Constants.CAT_SIZE/2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-Constants.CAT_SIZE/8, -Constants.CAT_SIZE/4);
    ctx.lineTo(0, -Constants.CAT_SIZE/1.8);
    ctx.lineTo(Constants.CAT_SIZE/6, -Constants.CAT_SIZE/4);
    ctx.fill();

    ctx.strokeStyle = Constants.COLORS.cat;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const tailWobble = Math.sin(Date.now() * 0.01) * 10;
    ctx.moveTo(-Constants.CAT_SIZE/3, 5);
    ctx.quadraticCurveTo(-Constants.CAT_SIZE/1.2, 5 + tailWobble, -Constants.CAT_SIZE/1.1, -5 + tailWobble);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(Constants.CAT_SIZE/3, -Constants.CAT_SIZE/5, 2.5, 0, Math.PI * 2);
    ctx.arc(Constants.CAT_SIZE/2, -Constants.CAT_SIZE/5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(Constants.CAT_SIZE/2.4, -Constants.CAT_SIZE/8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 select-none bg-[#1a0b2e]">
      <div className="relative overflow-hidden rounded-3xl shadow-[0_0_50px_rgba(139,92,246,0.3)] border-8 border-indigo-900 bg-slate-900" 
           style={{ width: Constants.GAME_WIDTH, height: Constants.GAME_HEIGHT }}
           onClick={handleJump}>
        
        <canvas 
          ref={canvasRef} 
          width={Constants.GAME_WIDTH} 
          height={Constants.GAME_HEIGHT}
        />

        {/* HUD */}
        {status === GameStatus.PLAYING && (
          <>
            <div className="absolute top-6 right-8 text-right pointer-events-none">
              <p className="text-pink-400 text-xs uppercase tracking-widest font-black">Lightyears</p>
              <h1 className="text-4xl font-mono text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{Math.floor(score / 10)}</h1>
            </div>
            <div className="absolute top-6 left-8 flex items-center gap-3 pointer-events-none bg-indigo-950/40 px-4 py-2 rounded-2xl border border-indigo-500/30 backdrop-blur-sm">
              <div className="text-2xl animate-bounce">🐟</div>
              <div>
                <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest leading-none">Treats</p>
                <p className="text-2xl font-mono text-white leading-none">{treatCount}</p>
              </div>
            </div>
          </>
        )}

        {/* Start Overlay */}
        {status === GameStatus.START && (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 to-purple-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
             <div className="mb-6 animate-bounce">
                <div className="w-24 h-24 bg-orange-400 rounded-full relative mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(251,146,60,0.6)]">
                   <div className="text-5xl">🐱</div>
                </div>
             </div>
            <h1 className="text-6xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-pink-500 to-cyan-400 drop-shadow-sm">Kiki's Adventure</h1>
            <p className="text-cyan-300 mb-10 font-bold uppercase tracking-widest text-sm">Beyond the Milky Way</p>
            <button 
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-12 py-5 rounded-2xl font-black text-2xl transition-all active:scale-95 shadow-[0_10px_0_rgb(139,92,246)] hover:translate-y-[-2px]"
              onClick={(e) => { e.stopPropagation(); resetGame(); }}
            >
              PLAY NOW
            </button>
            <p className="mt-12 text-xs text-indigo-200 font-bold opacity-75 uppercase tracking-tighter">Click to jump • Catch golden fish treats!</p>
          </div>
        )}

        {/* Game Over Overlay */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
            <h2 className="text-5xl font-black mb-6 text-rose-500 italic drop-shadow-lg">STARDUST!</h2>
            <div className="flex gap-10 mb-8">
               <div className="text-center">
                  <p className="text-xs uppercase tracking-tighter text-indigo-400 font-black mb-1">Traveled</p>
                  <p className="text-5xl font-mono font-black text-white">{Math.floor(score / 10)}</p>
               </div>
               <div className="text-center">
                  <p className="text-xs uppercase tracking-tighter text-amber-400 font-black mb-1">Treats</p>
                  <p className="text-5xl font-mono font-black text-amber-400">{treatCount}</p>
               </div>
               <div className="text-center">
                  <p className="text-xs uppercase tracking-tighter text-indigo-400 font-black mb-1">Top Score</p>
                  <p className="text-5xl font-mono font-black text-cyan-400">{highScore}</p>
               </div>
            </div>
            
            <div className="bg-indigo-900/40 p-6 rounded-3xl mb-8 border-2 border-indigo-500/30 max-w-[380px] shadow-2xl">
               <p className="text-lg font-bold italic text-cyan-200 leading-relaxed">
                 {isLoadingQuote ? "Scanning the nebula..." : `"${cosmicQuote}"`}
               </p>
            </div>

            <button 
              className="bg-gradient-to-r from-emerald-400 to-cyan-500 hover:from-emerald-300 hover:to-cyan-400 text-white px-14 py-5 rounded-2xl font-black text-2xl transition-all active:scale-95 shadow-[0_10px_0_rgb(8,145,178)] hover:translate-y-[-2px]"
              onClick={(e) => { e.stopPropagation(); resetGame(); }}
            >
              RESTART MISSION
            </button>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="flex gap-8 text-indigo-400 text-xs font-black uppercase tracking-[0.3em]">
           <span className="animate-pulse">Jump over Asteroids</span>
           <span className="text-indigo-800">|</span>
           <span className="animate-pulse text-amber-400">Collect Space Fish</span>
           <span className="text-indigo-800">|</span>
           <span className="animate-pulse">Save the Galaxy</span>
        </div>
      </div>
    </div>
  );
};

export default App;
