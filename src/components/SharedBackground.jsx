import React, { useEffect, useRef, useState } from 'react';

const SharedBackground = () => {
  const canvasRef = useRef(null);
  const [particles, setParticles] = useState([]);
  const starsRef = useRef([]);

  useEffect(() => {
    const initParticles = () => {
      const newParticles = [];
      for (let i = 0; i < 120; i++) {
        newParticles.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 0.6,
          speedX: (Math.random() - 0.5) * 0.25,
          speedY: (Math.random() - 0.5) * 0.25,
          opacity: Math.random() * 0.35 + 0.05,
        });
      }

      // create a subtle static starfield
      const stars = [];
      for (let i = 0; i < 220; i++) {
        stars.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 1.5 + 0.2,
          opacity: Math.random() * 0.6 + 0.05,
        });
      }
      starsRef.current = stars;
      setParticles(newParticles);
    };
    initParticles();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let mouse = { x: 0, y: 0 };

    const handleMouseMove = (e) => {
      // track mouse relative to viewport (not canvas) so pointer-events can be disabled on canvas
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // deeper base gradient to mimic the login look
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(7, 30, 83, 1)');
      gradient.addColorStop(0.45, 'rgba(17, 24, 85, 1)');
      gradient.addColorStop(1, 'rgba(56, 16, 82, 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // faint colored tint overlay
      const tint = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      tint.addColorStop(0, 'rgba(59,130,246,0.12)');
      tint.addColorStop(0.5, 'rgba(139,92,246,0.12)');
      tint.addColorStop(1, 'rgba(59,130,246,0.12)');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw static starfield behind moving particles
      starsRef.current.forEach((s) => {
        const sx = (s.x / 100) * canvas.width;
        const sy = (s.y / 100) * canvas.height;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity * 0.6})`;
        ctx.fill();
      });

      particles.forEach((particle, i) => {
        const x = (particle.x / 100) * canvas.width;
        const y = (particle.y / 100) * canvas.height;

        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        if (distance < 150) {
          const force = 0.3 * (1 - distance / 150);
          particles[i].x += (dx / distance) * force;
          particles[i].y += (dy / distance) * force;
        }

        particles[i].x += particle.speedX;
        particles[i].y += particle.speedY;

        if (particles[i].x > 100) particles[i].x = 0;
        if (particles[i].x < 0) particles[i].x = 100;
        if (particles[i].y > 100) particles[i].y = 0;
        if (particles[i].y < 0) particles[i].y = 100;

        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.fill();

        // draw occasional faint connections for a subtle network effect
        if (i % 6 === 0) {
          particles.forEach((otherParticle, j) => {
            if (i !== j) {
              const otherX = (otherParticle.x / 100) * canvas.width;
              const otherY = (otherParticle.y / 100) * canvas.height;
              const dist = Math.sqrt((x - otherX) ** 2 + (y - otherY) ** 2);

              if (dist < 80) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(otherX, otherY);
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * (1 - dist / 80)})`;
                ctx.lineWidth = 0.4;
                ctx.stroke();
              }
            }
          });
        }
      });

      // background wavy lines
      ctx.beginPath();
      for (let i = 0; i < canvas.width; i += 60) {
        const y = Math.sin(i * 0.008 + Date.now() * 0.0012) * 18 + canvas.height / 2;
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const animate = () => {
      drawParticles();
      animationFrameId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // listen on window so the canvas can be non-interactive (pointer-events none)
    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [particles]);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900" style={{ zIndex: 0 }} />

      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />

      <div className="fixed inset-0 pointer-events-none bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-blue-800/20" style={{ zIndex: 0 }}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
      </div>

      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>
    </>
  );
};

export default SharedBackground;
