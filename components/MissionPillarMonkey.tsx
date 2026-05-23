"use client";

/* ============================================================================
   MISSION PILLAR MONKEY — un mono 3D embedded EN el flujo del pilar.

   Diferencia clave con el approach anterior (MissionMascot sticky):
     - Este componente NO es sticky/fixed. Es parte del DOM normal — vive
       dentro del pilar al que pertenece.
     - Cuando el usuario scrollea, el mono se desplaza con el pilar (sube
       por arriba y desaparece al salir del viewport, como cualquier otro
       contenido del DOM).
     - Cuando el pilar entra al viewport (IntersectionObserver), el mono
       dispara su animacion una vez (cae con el movimiento del clip).
     - Al terminar, el mono queda en pose final dentro del pilar.

   Cada pilar instancia su propio <MissionPillarMonkey />. Los 4 monos son
   independientes — el del .002 no se entera de lo que pasa en el .001.

   Detalle tecnico CRITICO:
     - useGLTF cachea el scene; usarlo crudo en multiples instancias hace
       que solo una renderice (las otras "roban" el mesh). Necesitamos
       SkeletonUtils.clone para clonar el scene + armature correctamente —
       una funcion oficial de three.js diseñada para skinned mesh.
     - frameloop="demand" + invalidate() — el canvas no renderiza frames
       de forma continua, solo cuando hay cambios (la animacion del mixer
       invalida automaticamente).
   ============================================================================ */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeletal } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const MONO_SRC = "/assets/3d/mono-rigged.glb";
useGLTF.preload(MONO_SRC);

const ANIM_MIN_DURATION_S = 0.5;
const TARGET_SIZE         = 2.5;
const ANIM_FADE_IN_S      = 0.15;
const ANIM_TIME_SCALE     = 0.6;

interface MonkeyProps {
  triggerSignalRef: React.MutableRefObject<boolean>;
}

function Monkey({ triggerSignalRef }: MonkeyProps) {
  const { scene, animations } = useGLTF(MONO_SRC);
  const ref = useRef<THREE.Group>(null);

  /* SkeletonUtils.clone — clona correctamente el scene incluyendo el
     skeleton binding del skinned mesh. Si usaramos scene.clone() (Three.js
     default), el clon mantendria una referencia al skeleton ORIGINAL del
     cache de useGLTF, y cuando hay multiples instancias (los 4 pilares),
     solo una renderiza bien y las otras "comparten" el mesh roto. */
  const cloned = useMemo(() => {
    const c = cloneSkeletal(scene);
    /* Auto-fit por altura + recentrado al origen. Bbox calculado sobre
       el clone (no sobre el scene original) para no afectar a otros
       componentes que usen el mismo GLB. */
    const bbox = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const fitScale = TARGET_SIZE / (size.y || 1);
    c.scale.setScalar(fitScale);
    bbox.setFromObject(c);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    c.position.sub(center);
    return c;
  }, [scene]);

  /* Strip root motion: mismo approach que antes — eliminar tracks de
     posicion del bone raiz para que el mono no se desplace en world space
     durante el clip. Asi la animacion solo deforma la pose, sin trasladar
     al mono fuera de su anclaje en el pilar. */
  const cleanedAnimations = useMemo(() => {
    return animations.map((clip) => {
      const cleaned = clip.clone();
      cleaned.tracks = cleaned.tracks.filter((track) => {
        const name = track.name.toLowerCase();
        const isPosition = name.endsWith(".position");
        const isRootish =
          name.includes("hips") ||
          name.includes("armature") ||
          name.includes("rootnode") ||
          name.startsWith(".bones[0]");
        return !(isPosition && isRootish);
      });
      return cleaned;
    });
  }, [animations]);

  const { actions, mixer, names } = useAnimations(cleanedAnimations, ref);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (!names.length) return;
    const action = actions[names[0]];
    if (!action) return;
    const duration = action.getClip().duration;
    if (duration < ANIM_MIN_DURATION_S) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = ANIM_TIME_SCALE;
    /* Pose final como pose inicial: arrancar action en time=duration, evaluar
       una vez con dt=0, pausar. El mono aparece directamente en el ultimo
       frame del clip — no se ve la T-pose ni la animacion al montar. */
    action.reset();
    action.play();
    action.time = duration;
    mixer.update(0);
    action.paused = true;
    actionRef.current = action;
  }, [actions, mixer, names]);

  useFrame(() => {
    if (!triggerSignalRef.current) return;
    triggerSignalRef.current = false;
    const action = actionRef.current;
    if (!action) return;
    action.reset();
    action.fadeIn(ANIM_FADE_IN_S);
    action.play();
  });

  return (
    <group ref={ref}>
      <primitive object={cloned} />
    </group>
  );
}

export default function MissionPillarMonkey() {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  /* triggerSignalRef = bool. true → el Monkey en su next useFrame dispara
     la animacion y vuelve a false. Usamos ref (no state) para evitar
     re-renders del Canvas — el cambio se aplica via useFrame. */
  const triggerSignalRef = useRef<boolean>(false);
  /* hasTriggeredRef: solo disparamos UNA vez por entrada al viewport. Sin
     esto, si el usuario hace micro-movimientos y entra/sale del threshold
     repetidamente, el mono dispararia muchas veces. */
  const hasTriggeredRef = useRef<boolean>(false);
  /* Mount lazy: hasta que el contenedor no entra al viewport (con margin
     de 200px), no instanciamos el Canvas — evita pagar el costo de
     instanciar three.js para pilares que el usuario nunca llega a ver. */
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShouldMount(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    /* Segundo observer con threshold mas alto para el TRIGGER de animacion.
       Cuando el container esta mas de 30% dentro del viewport, dispara.
       Reset al salir completamente, asi se re-dispara la proxima vez que
       el usuario vuelve a este pilar (scroll up + scroll down). */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.3 && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          triggerSignalRef.current = true;
        } else if (entry.intersectionRatio === 0) {
          hasTriggeredRef.current = false;
        }
      },
      { threshold: [0, 0.3] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {!shouldMount ? null : (
        <Canvas
          /* frameloop="always" — renderiza cada frame. Necesario para que
             el AnimationMixer avance los keyframes del clip. Con demand
             el mixer no se actualiza correctamente sin invalidates manuales.
             4 canvas siempre-renderizando consume GPU pero solo cuando son
             visibles (los browsers pausan WebGL en tabs hidden). */
          frameloop="always"
          camera={{ position: [0, 0.4, 6.5], fov: 36 }}
          dpr={isMobile ? 1 : [1, 1.5]}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
          }}
          gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[5, 6, 5]}
            intensity={1.4}
            color="#ffd9b8"
          />
          {!isMobile && (
            <>
              <directionalLight
                position={[-4, -2, -3]}
                intensity={0.45}
                color="#5da3ff"
              />
              <pointLight position={[0, 0, 5]} intensity={0.4} color="#ffffff" />
            </>
          )}
          <Suspense fallback={null}>
            <Monkey triggerSignalRef={triggerSignalRef} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
