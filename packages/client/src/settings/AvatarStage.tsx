import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SENAS, isHeadSena, type AvatarSpec, type Sena } from '@la-base/shared';
import { makeFace, makeHand, handStyleOf, type FaceRig } from '../table3d/faces';
import { NOD_HZ, PUPPET_FPS, SENA_HOLD, senaAmount } from '../table3d/senaPlay';
import { PALETTE, hex } from '../table3d/look';

// Your face under a spotlight from the ceiling beside the settings ledger, alive the way it is at the table: it floats and
// looks around a little, blinks, and now and then makes a seña (a random one) — stop-motion, like a puppet. Your
// two hands float under it. Picking another face in the ledger swaps it on the spot.

const GAP_MIN = 1.1; // s of rest between señas
const GAP_MAX = 2.6;

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
    camera.position.set(0, 0.0, -1.9); // the face looks down −z: look at it from there, the hands in view below it
    camera.lookAt(0, -0.12, 0);
    scene.add(new THREE.AmbientLight(0xffeedd, 0.55));
    const lamp = new THREE.SpotLight(0xffe2c0, 14, 10, 0.5, 0.55, 1.5);
    lamp.target.position.set(0, 0, 0);
    scene.add(lamp, lamp.target);

    // the face, and two hands floating under it (the right one open, the left one closed as round the fan)
    const holder = new THREE.Group();
    scene.add(holder);
    let mask: FaceRig;
    let hands: ReturnType<typeof makeHand>[] = [];
    const build = (a: AvatarSpec) => {
      mask = makeFace(a, 3);
      holder.add(mask.head);
      hands = ([-1, 1] as const).map((sx) => {
        const h = makeHand(handStyleOf(a), sx > 0 ? 'rest' : 'hold', sx, hex(PALETTE.teal));
        h.group.position.set(-sx * 0.17, -0.36, -0.08); // the face looks down −z, so its right is on our left
        h.group.rotation.set(-0.5, Math.PI + sx * 0.35, 0); // fingers toward you, the backs of the hands up
        scene.add(h.group);
        return h;
      });
    };
    build(avatar);
    const swap = (a: AvatarSpec) => {
      holder.remove(mask.head);
      mask.dispose();
      for (const h of hands) {
        scene.remove(h.group);
        h.dispose();
      }
      build(a);
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
      holder.rotation.set(pitch, yaw, 0, 'YXZ'); // (a face looks down −z: the camera looks at it from there)
      holder.position.y = Math.sin(ts * 1.3) * 0.006; // it floats
      mask.sena(face, amount);
      mask.tick(t); // (it blinks by itself)
      hands.forEach((h, i) => (h.group.position.y = -0.36 + Math.sin(ts * 1.1 + i * 2) * 0.004));
      lamp.position.set(Math.sin(t * 0.3) * 0.06, 1.7, -0.35); // overhead, a little in front: a spotlight from the ceiling
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
      mask.dispose();
      hands.forEach((h) => h.dispose());
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
