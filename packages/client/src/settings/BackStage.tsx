import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { backTexture } from '../table3d/cardBacks';
import { PALETTE, hex } from '../table3d/look';

// A big card hanging in a pool of lamplight beside the settings ledger, so the chosen back can be
// seen properly: the card slowly turns and tips while the lamp drifts across it, and the sheen of
// the print slides over the design from every angle.

const W = 1.22; // the card's proportions (61 × 95 mm)
const H = 1.9;
const THICK = 0.018;

export function BackStage() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL: the small previews in the list still work
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
    camera.position.set(0, 0, 6.2);

    // the back design (the shared texture repaints itself when another is picked), a coated print
    const print = new THREE.MeshPhysicalMaterial({ map: backTexture(), roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35 });
    const edge = new THREE.MeshStandardMaterial({ color: hex(PALETTE.bone), roughness: 0.8 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(W, H, THICK), [edge, edge, edge, edge, print, print]);
    scene.add(card);

    scene.add(new THREE.AmbientLight(0xffeedd, 0.5));
    const lamp = new THREE.SpotLight(0xffe9cf, 55, 14, 0.5, 0.6, 1.6) // a warm white: the print keeps its own colours;
    lamp.target = card;
    scene.add(lamp);

    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 440;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      const t = still ? 1.5 : clock.getElapsedTime();
      // the card: turns a little each way and tips, with a slow float
      card.rotation.set(Math.sin(t * 0.45) * 0.28, Math.sin(t * 0.6) * 0.62, Math.sin(t * 0.3) * 0.05);
      card.position.y = Math.sin(t * 0.8) * 0.04;
      // the lamp swings above, left to right and front to back, so the light rakes the print
      lamp.position.set(Math.sin(t * 0.55) * 3.2, 3.6 + Math.sin(t * 0.37) * 0.6, 3.4 + Math.cos(t * 0.5) * 1.2);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    frame();

    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      card.geometry.dispose();
      print.dispose(); // the texture is shared with the table: not disposed here
      edge.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="back-stage" ref={host} aria-hidden />;
}
