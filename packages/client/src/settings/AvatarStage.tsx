import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SENAS, isHeadSena, type AvatarSpec, type Sena } from '@la-base/shared';
import { makeMask } from '../table3d/avatar';
import { NOD_HZ, PUPPET_FPS, SENA_HOLD, senaAmount } from '../table3d/senaPlay';
import { PALETTE, hex } from '../table3d/look';

// Your mask in a pool of lamplight beside the settings ledger, alive the way it is at the table: it breathes
// and looks around a little, blinks, and now and then makes a seña (a random one) — stop-motion, like a
// puppet. Changing a part or a colour in the ledger swaps the face on the spot.

const GAP_MIN = 1.1; // s of rest between señas
const GAP_MAX = 2.6;
const BLINK_EVERY = 3.2;

export function AvatarStage({ avatar }: { avatar: AvatarSpec }) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<{ swap: (a: AvatarSpec) => void } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL: the pickers still work
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 10);
    camera.position.set(0, 0.0, -2.05); // the mask faces −z: look at it from there (far enough for the whole hood)
    camera.lookAt(0, -0.03, 0);

    // the bust: a coat under the head, so the mask is not floating
    const coatMat = new THREE.MeshStandardMaterial({ color: hex(PALETTE.soot), roughness: 1 });
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.34, 0.4, 18), coatMat);
    coat.position.set(0, -0.42, 0.0);
    coat.scale.z = 0.75;
    scene.add(coat);
    scene.add(new THREE.AmbientLight(0xffeedd, 0.55));
    const lamp = new THREE.SpotLight(0xffe2c0, 9, 10, 0.55, 0.6, 1.5);
    lamp.target.position.set(0, 0, 0);
    scene.add(lamp, lamp.target);

    let mask = makeMask(avatar);
    scene.add(mask.head);
    const swap = (a: AvatarSpec) => {
      scene.remove(mask.head);
      mask.head.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      mask = makeMask(a);
      scene.add(mask.head);
    };
    live.current = { swap };

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
    // a seña at a time, picked at random, with a rest between them
    let cur: { s: Sena; t0: number } | null = null;
    let nextAt = 0.9;
    let raf = 0;
    const frame = () => {
      const t = still ? 0 : clock.getElapsedTime();
      const ts = Math.floor(t * PUPPET_FPS) / PUPPET_FPS; // stop-motion, as at the table
      if (!still) {
        if (!cur && t >= nextAt) cur = { s: SENAS[Math.floor(Math.random() * SENAS.length)].id, t0: t };
        if (cur && t - cur.t0 > SENA_HOLD + 0.3) {
          cur = null;
          nextAt = t + GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
        }
      }
      // it looks around a little, as the masks do while they wait
      let yaw = Math.sin(ts * 0.55) * 0.42;
      let pitch = -0.08 + Math.sin(ts * 0.4 + 1) * 0.07;
      let face: Sena | null = null;
      let amount = 0;
      if (cur) {
        const u = Math.floor((t - cur.t0) * PUPPET_FPS) / PUPPET_FPS;
        amount = senaAmount(cur.s, u);
        if (isHeadSena(cur.s)) {
          const swing = Math.sin(u * Math.PI * 2 * NOD_HZ) * amount;
          if (cur.s === 'si') pitch += swing * 0.22;
          else yaw += swing * 0.32;
        } else {
          face = cur.s;
          yaw *= 0.25; // it looks to you while it signs
        }
      }
      // a blink every so often (the 'nada' seña closes the eyes, so use the same lids)
      if (!face && !still && ts % BLINK_EVERY < 0.2) {
        face = 'nada';
        amount = Math.sin(((ts % BLINK_EVERY) / 0.2) * Math.PI);
      }
      mask.head.rotation.set(pitch, yaw, 0, 'YXZ'); // (a mask faces −z: the camera looks at it from there)
      mask.sena(face, amount);
      mask.float(t);
      lamp.position.set(Math.sin(t * 0.5) * 0.9, 0.95, -1.1 + Math.cos(t * 0.4) * 0.3);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    frame();

    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => {
      live.current = null;
      cancelAnimationFrame(raf);
      obs.disconnect();
      coat.geometry.dispose();
      coatMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // the stage is built once; the avatar prop only swaps the face (below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    live.current?.swap(avatar);
  }, [avatar]);

  return <div className="back-stage avatar-stage" ref={host} aria-hidden />;
}
