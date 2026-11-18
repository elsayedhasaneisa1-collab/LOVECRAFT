"use client";

import React, { useEffect, useRef, useState } from "react";

interface ThreeSceneCanvasProps {
  primaryColor: string;
  accentColor: string;
  disabled?: boolean;
}

export default function ThreeSceneCanvas({
  primaryColor,
  accentColor,
  disabled = false,
}: ThreeSceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Respect prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setFallback(true);
      return;
    }

    let disposed = false;
    let rafId = 0;
    let cleanupFn: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed || !container) return;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: window.devicePixelRatio <= 1.5,
          powerPreference: "low-power",
        });

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(width, height);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.display = "block";
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
        camera.position.z = 7;

        // Ambient + directional lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambient);

        const pLight = new THREE.PointLight(new THREE.Color(primaryColor), 2.4, 25);
        pLight.position.set(4, 3, 5);
        scene.add(pLight);

        const aLight = new THREE.PointLight(new THREE.Color(accentColor), 1.8, 25);
        aLight.position.set(-4, -3, 4);
        scene.add(aLight);

        // Sculptural wireframe crystal icosahedron
        const crystalGeo = new THREE.IcosahedronGeometry(1.9, 1);
        const crystalMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(primaryColor),
          wireframe: true,
          transparent: true,
          opacity: 0.24,
          roughness: 0.2,
          metalness: 0.7,
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(2.1, 0.4, -1.5);
        scene.add(crystal);

        // Secondary orbital ring
        const ringGeo = new THREE.TorusGeometry(2.6, 0.018, 12, 90);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(accentColor),
          transparent: true,
          opacity: 0.28,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI * 0.35;
        ring.position.set(-1.8, -0.5, -2.2);
        scene.add(ring);

        // Floating luminous particle field
        const particleCount = width < 640 ? 90 : 170;
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 16;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const pMat = new THREE.PointsMaterial({
          color: new THREE.Color(accentColor),
          size: 0.055,
          transparent: true,
          opacity: 0.65,
        });
        const points = new THREE.Points(pGeo, pMat);
        scene.add(points);

        let targetX = 0;
        let targetY = 0;

        const onPointerMove = (e: PointerEvent) => {
          targetX = (e.clientX / window.innerWidth - 0.5) * 0.7;
          targetY = (e.clientY / window.innerHeight - 0.5) * 0.5;
        };

        const onResize = () => {
          if (!container || disposed) return;
          const w = container.clientWidth || window.innerWidth;
          const h = container.clientHeight || window.innerHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };

        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("resize", onResize, { passive: true });

        const animate = () => {
          if (disposed) return;
          rafId = window.requestAnimationFrame(animate);
          if (document.hidden) return;

          crystal.rotation.x += 0.0022;
          crystal.rotation.y += 0.0034;
          ring.rotation.z += 0.0018;
          points.rotation.y += 0.0007;

          camera.position.x += (targetX - camera.position.x) * 0.04;
          camera.position.y += (-targetY - camera.position.y) * 0.04;
          camera.lookAt(scene.position);

          renderer.render(scene, camera);
        };
        animate();

        cleanupFn = () => {
          window.cancelAnimationFrame(rafId);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("resize", onResize);
          crystalGeo.dispose();
          crystalMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
          pGeo.dispose();
          pMat.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        };
      } catch {
        // Never crash the site if WebGL/Three.js fails on any device or browser
        if (!disposed) setFallback(true);
      }
    })();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      if (cleanupFn) cleanupFn();
    };
  }, [primaryColor, accentColor, disabled]);

  if (disabled || fallback) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-45"
        style={{
          background: `radial-gradient(circle at 22% 24%, ${primaryColor}33 0%, transparent 45%), radial-gradient(circle at 78% 72%, ${accentColor}28 0%, transparent 50%)`,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    />
  );
}
