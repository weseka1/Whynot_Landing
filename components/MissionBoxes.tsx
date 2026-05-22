"use client";

/* ============================================================================
   MISSION BOXES — Drop-off progresivo 4→3→2→1.

     Pilar .001 → estrella de 4 puntas (las 4 cajas).
     Pilar .002 → triángulo de 3 puntas (bape ya quedó atrás).
     Pilar .003 → 2 cajas enfrentadas (bape + balenciaga atrás).
     Pilar .004 → 1 caja sola al centro (dior).

   Cada caja "soltada" se queda en su posición de salida y sube en world Y
   proporcional al scroll restante → desaparece por arriba (scroll natural).
   Si scrolleás hacia arriba, todas las cajas vuelven y reintegran la
   formación. Las formaciones también alternan izq/der según el pilar
   (texto IZQ → cajas DER, etc.), interpolando suave en la transición.
   ============================================================================ */

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const BOX_SOURCES = [
  "/assets/3d/boxes/box-1-bape.glb",       // .001 Source
  "/assets/3d/boxes/box-2-balenciaga.glb", // .002 Build
  "/assets/3d/boxes/box-3-hands.glb",      // .003 Release
  "/assets/3d/boxes/box-4-dior.glb",       // .004 Archive
];

BOX_SOURCES.forEach((src) => useGLTF.preload(src));

const PILLAR_COUNT  = BOX_SOURCES.length; // 4
const PROGRESS_IN   = 0.08;
const PROGRESS_OUT  = 0.92;

const R = 0.65;                 // radio de las formaciones — más chico = cajas más juntas (compacto, tipo nucleo del atomo)
const SQRT2_2 = 0.7071068;      // sin/cos(45°) — vértices diagonales (estrella ×)
const SQRT3_2 = 0.8660254;      // sin(60°) — triángulo
const TARGET_BOX_SIZE = 0.62;   // tamaño objetivo (dimension maxima) de cada caja en unidades de mundo. Cada GLB se auto-escala a esto sin importar su tamaño nativo → control deterministico del extent de la caja para que entre en el cage de anillos
const GROUP_TILT_X = 0.16;      // inclinación del grupo en X → perspectiva isométrica
const GROUP_Y_OFFSET = -0.65;   // bajar toda la composición → no choca con el texto del pilar
const Y_VERTEX_OFFSET = Math.PI / 4; // rotación Y base = 45° → cada caja muestra esquina (vértice) al frente
const ORBIT_RATE = 0.50;        // rad/s — velocidad de la orbita conjunta de las cajas (un poco mas rapido que el SPIN propio anterior)
const ORBIT_TILT = 1.30;        // rad (~74°) — el plano orbital queda casi horizontal, como anillo de Saturno/Jupiter visto desde arriba en perspectiva

/* ANILLOS DORADOS — icono atomico clasico: 3 elipses identicas en el plano
   de la pantalla, rotadas 60° una respecto de otra alrededor del eje
   camara-perpendicular (Z). Construccion en 2 pasos por anillo:
     1) <mesh rotation={[RING_TILT_X, 0, 0]}>  inclina alrededor de X →
        el toro se ve como ELIPSE (no circulo) desde la camara, con eje mayor
        horizontal y eje menor cos(RING_TILT_X)
     2) <group rotation={[0, 0, zAngle]}>      rota esa elipse alrededor del
        eje de la camara → produce 3 elipses rotadas en el plano de la pantalla
   Resultado: la firma exacta del simbolo del atomo (tipo logo Wikipedia),
   donde los 3 anillos cruzan en el centro y son rotaciones puras del mismo
   patron. CRITICO: rotar alrededor de Z (camera axis), NO Y (vertical) — el
   intento previo con rotacion Y producia un cage con un anillo casi horizontal
   y dos casi verticales (no es el icono atomico). */
const RING_RADIUS = 1.45;                      // jaula ajustada: cajas a orbit radius 0.65 con TARGET_BOX_SIZE 0.62 (half-diag ~0.54) → extent maximo ~1.19. RING_RADIUS 1.45 da margen ~0.26 (cage tight como en la referencia)
const RING_TUBE = 0.030;                       // tubo del toro: ligeramente mas grueso para presencia visual al radio menor
const RING_COLOR = "#d9a850";
const RING_EMISSIVE = "#8a5a14";
const RING_TILT_X = Math.PI / 3;               // 60° de inclinacion del toro alrededor de X → elipse pronunciada (eje menor = cos60° = 0.5 del eje mayor)

/* RING_Z_ANGLES — angulos de rotacion en el plano de la pantalla (eje Z, eje
   de la camara). 0° → elipse horizontal; 60° → tilt arriba-derecha; 120° →
   tilt arriba-izquierda. Distribucion 0°/60°/120° (NO 0°/120°/240°: con 180°
   de span el resultado tiene simetria 2-fold redundante; con 120° se ve la
   firma del icono atomico). */
const RING_Z_ANGLES = [
  0,
  Math.PI / 3,
  (2 * Math.PI) / 3,
];
const ANCHOR_RISE = 0;          // la caja anclada NO se mueve — queda quieta en su slot y se desvanece
/* Fade unificado por "lifetime" de cada caja:
   - La caja es visible mientras activeIndex < index+1 (su pilar todavía corre).
   - Fade-out en el último tramo del pilar de la caja, termina exactamente
     en el cambio de pilar → al pilar siguiente NO se ve nada de la anterior. */
const LIFETIME_FADE_BEFORE = 0.30; // último 30% del pilar de la caja: fade-out
const LIFETIME_FADE_AFTER  = 0.00; // opacity = 0 exactamente al cambio de pilar
const TRANSITION_START = 0.40;  // % del pilar donde arranca la transición (más larga = más fluida)
const TRANSITION_END   = 1.00;
const POSITION_DAMP = 7;        // lerp temporal de posición — alto = sigue al target, bajo = perezoso
const OPACITY_DAMP  = 6;
const OFFSET_DIVISOR = 5;       // viewport.width/OFFSET_DIVISOR = magnitud del lateral izq/der

/* FORMATIONS[N][slot] = posición (x,y,z) del slot `slot` cuando hay N cajas activas.
   Slot 0 = la caja que va a anclarse al final de ESTE pilar (la "saliente").
   Slot 1.. = las que siguen al pilar(es) siguiente(s).
   Las posiciones están elegidas para que cada caja se mueva lo MÍNIMO al
   transicionar entre formaciones consecutivas (4→3→2→1).                       */
const FORMATIONS: Record<number, [number, number, number][]> = {
  4: [
    /* Estrella × (4 vértices diagonales), no cruz +.
       Cada caja queda en una esquina diagonal y con Y_VERTEX_OFFSET
       muestra su vértice al frente → silueta de estrella de 4 puntas. */
    [ R * SQRT2_2,  R * SQRT2_2, 0], // slot 0 → caja 0 (bape, sale al pilar 2) — NE
    [-R * SQRT2_2,  R * SQRT2_2, 0], // slot 1 → caja 1                          — NW
    [-R * SQRT2_2, -R * SQRT2_2, 0], // slot 2 → caja 2                          — SW
    [ R * SQRT2_2, -R * SQRT2_2, 0], // slot 3 → caja 3                          — SE
  ],
  3: [
    [ 0,            R,        0], // slot 0 → caja 1 (bale, apex; sale al pilar 3)
    [-R * SQRT3_2, -R * 0.5,  0], // slot 1 → caja 2
    [ R * SQRT3_2, -R * 0.5,  0], // slot 2 → caja 3
  ],
  2: [
    [-R, 0, 0],     // slot 0 → caja 2 (hands; sale al pilar 4)
    [ R, 0, 0],     // slot 1 → caja 3
  ],
  1: [
    [0, 0, 0],      // slot 0 → caja 3 (dior, sola al centro)
  ],
};

/* Cuál es la posición de la caja `boxIdx` cuando estás en el pilar `pillarIdx`:
   - Cantidad de cajas activas en ese pilar: PILLAR_COUNT - pillarIdx
   - Slot de la caja: boxIdx - pillarIdx                                          */
function posOnPillar(pillarIdx: number, boxIdx: number): [number, number, number] {
  const N = PILLAR_COUNT - pillarIdx;
  const slot = boxIdx - pillarIdx;
  return FORMATIONS[N][slot];
}

/* Signo del offset lateral según el pilar:
     pilar 0 (.001): texto IZQ → cajas DER → +1
     pilar 1 (.002): texto DER → cajas IZQ → -1
     pilar 2 (.003): texto IZQ → cajas DER → +1
     pilar 3 (.004): texto DER → cajas IZQ → -1                                   */
function pillarSign(pillarIdx: number): number {
  return pillarIdx % 2 === 0 ? 1 : -1;
}

interface BoxProps {
  src: string;
  index: number;
  progressRef: React.MutableRefObject<number>;
}

function Box({ src, index, progressRef }: BoxProps) {
  const { scene } = useGLTF(src);
  const ref = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.Material[]>([]);

  /* Clonamos scene + materiales para mutar opacity sin afectar otras instancias.
     Auto-fit: medimos el bbox del GLB nativo y lo escalamos para que su
     dimension maxima quede en TARGET_BOX_SIZE — asi cada caja tiene exactamente
     el mismo extent visual sin importar las unidades nativas del modelo
     (los GLBs pueden venir con escalas muy distintas; antes se usaba
     BASE_SCALE=0.5 fijo y las cajas terminaban con tamaños imprevisibles).
     Despues recentro el modelo para que su centro caiga en el origen → la
     posicion del wrapper <group> es exactamente la posicion del centro de la caja. */
  const cloned = useMemo(() => {
    const c = scene.clone();

    const bbox = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = TARGET_BOX_SIZE / maxDim;
    c.scale.setScalar(fitScale);

    bbox.setFromObject(c);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    c.position.sub(center);

    const mats: THREE.Material[] = [];
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = (mesh.material as THREE.Material).clone();
        mat.transparent = true;
        mesh.material = mat;
        mats.push(mat);
      }
    });
    materialsRef.current = mats;
    return c;
  }, [scene]);

  /* Phase offset por caja → no spinean todas en el mismo ángulo */
  const phaseOffset = useMemo(() => index * (Math.PI / 3), [index]);

  useFrame((state, dt) => {
    const obj = ref.current;
    if (!obj) return;

    const p = progressRef.current;
    const t = THREE.MathUtils.clamp(
      (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
      0,
      1
    );
    const activeIndex = t * PILLAR_COUNT; // 0..PILLAR_COUNT

    const currentPillar = Math.min(Math.floor(activeIndex), PILLAR_COUNT - 1);
    const tInPillar = activeIndex - currentPillar;

    /* El offset lateral izq/der por pilar lo aplica el grupo padre (lateralRef
       en BoxStar). Aca la caja solo calcula su posicion en el sistema de la
       formacion + orbita; el desplazamiento al costado del texto del pilar es
       compartido con los anillos. */
    let targetX: number, targetY: number, targetZ: number;

    /* OPACITY UNIFICADA: función única del activeIndex, no del branch.
       Visible mientras la caja está "en vida"; fade en ventana centrada
       en su fin. La última caja (dior) nunca se va.                    */
    let targetOpacity = 1;
    if (index < PILLAR_COUNT - 1) {
      const endOfLife = index + 1;
      targetOpacity = 1 - THREE.MathUtils.smoothstep(
        activeIndex,
        endOfLife - LIFETIME_FADE_BEFORE,
        endOfLife + LIFETIME_FADE_AFTER
      );
    }

    if (index < currentPillar) {
      /* ===== Caja ya ANCLADA — la posición sigue calculada para
         reversibilidad (scroll up reintegra la caja a la formación).
         Misma orbita inclinada que en el branch activo. ===== */
      const base = posOnPillar(index, index);
      const scrollSince = activeIndex - (index + 1);

      const orbitAngle = state.clock.elapsedTime * ORBIT_RATE;
      const cosO = Math.cos(orbitAngle);
      const sinO = Math.sin(orbitAngle);
      const ox = base[0] * cosO - base[1] * sinO;
      const oy = base[0] * sinO + base[1] * cosO;
      const oz = base[2];

      const cosT = Math.cos(ORBIT_TILT);
      const sinT = Math.sin(ORBIT_TILT);
      targetX = ox;
      targetY = oy * cosT - oz * sinT + Math.max(scrollSince, 0) * ANCHOR_RISE;
      targetZ = oy * sinT + oz * cosT;
    } else {
      /* ===== Caja ACTIVA (en formación o transicionando) ===== */
      const posNow = posOnPillar(currentPillar, index);

      let posTarget: [number, number, number];
      let transitionT: number;

      const isLastPillar = currentPillar === PILLAR_COUNT - 1;
      const isLeavingHere = index === currentPillar && !isLastPillar;

      if (isLastPillar) {
        posTarget = posNow;
        transitionT = 0;
      } else if (isLeavingHere) {
        posTarget = posNow;
        transitionT = THREE.MathUtils.smoothstep(tInPillar, TRANSITION_START, TRANSITION_END);
      } else {
        posTarget = posOnPillar(currentPillar + 1, index);
        transitionT = THREE.MathUtils.smoothstep(tInPillar, TRANSITION_START, TRANSITION_END);
      }

      const formX = THREE.MathUtils.lerp(posNow[0], posTarget[0], transitionT);
      const formY = THREE.MathUtils.lerp(posNow[1], posTarget[1], transitionT);
      const formZ = THREE.MathUtils.lerp(posNow[2], posTarget[2], transitionT);

      /* Órbita conjunta inclinada: las 4 cajas giran a la vez alrededor del
         eje central de la formación. Aplicamos dos rotaciones:
         1) rotacion alrededor del eje Z local (giro en XY) → orbita
         2) rotacion alrededor del eje X (inclinacion ORBIT_TILT) → el plano
            de la orbita se inclina hacia atras, generando perspectiva: las
            cajas se acercan/alejan en Z mientras giran. */
      const orbitAngle = state.clock.elapsedTime * ORBIT_RATE;
      const cosO = Math.cos(orbitAngle);
      const sinO = Math.sin(orbitAngle);
      const ox = formX * cosO - formY * sinO;
      const oy = formX * sinO + formY * cosO;
      const oz = formZ;

      const cosT = Math.cos(ORBIT_TILT);
      const sinT = Math.sin(ORBIT_TILT);
      targetX = ox;
      targetY = oy * cosT - oz * sinT;
      targetZ = oy * sinT + oz * cosT;
    }

    /* Lerp temporal: la posición persigue al target con easing exponencial.
       Aunque target salte al cruzar pilares, la posición real interpola suavemente.
       Framerate-independent: `1 - exp(-dt*k)` da la misma respuesta en 60/120 fps. */
    const kPos = 1 - Math.exp(-dt * POSITION_DAMP);
    obj.position.x += (targetX - obj.position.x) * kPos;
    obj.position.y += (targetY - obj.position.y) * kPos;
    obj.position.z += (targetZ - obj.position.z) * kPos;

    /* La escala ya está fijada en el modelo clonado (auto-fit a
       TARGET_BOX_SIZE) — no se toca aca para no anularla. */

    /* Orientación fija — la caja no gira sobre su propio eje.
       Y_VERTEX_OFFSET = 45° → muestra un vértice al frente. El movimiento
       rotacional lo aplica el grupo padre (todas orbitan juntas en el mismo
       eje concéntrico). phaseOffset desfasa la orientación inicial para que
       no luzcan idénticas. */
    obj.rotation.y = Y_VERTEX_OFFSET + phaseOffset;
    obj.rotation.x = 0;

    /* Opacity también con damp para fade fluido */
    const kOp = 1 - Math.exp(-dt * OPACITY_DAMP);
    const currentOp = materialsRef.current[0]?.opacity ?? 1;
    const newOp = currentOp + (targetOpacity - currentOp) * kOp;
    for (const m of materialsRef.current) m.opacity = newOp;
    obj.visible = newOp > 0.01;
  });

  /* Wrapper <group>: la posicion/rotacion del grupo controla la trayectoria
     orbital de la caja. El <primitive> interior contiene el GLB ya pre-escalado
     y recentrado (auto-fit), asi el grupo posiciona EL CENTRO de la caja
     directamente — sin sorpresas por el pivot nativo del modelo. */
  return (
    <group ref={ref}>
      <primitive object={cloned} />
    </group>
  );
}

interface BoxStarProps {
  progressRef: React.MutableRefObject<number>;
}

/* ANILLOS — 3 toros dorados formando el simbolo del atomo clasico.
   Estructura por anillo: <group rotation={[0, 0, zAngle]}> contiene un
   <mesh rotation={[RING_TILT_X, 0, 0]}> con el toro. La composicion de las
   2 rotaciones (en orden mesh→group, es decir Rz(zAngle) * Rx(RING_TILT_X))
   tilta el toro alrededor de X y luego lo rota en el plano de la pantalla
   alrededor de Z → desde la camara se ve UNA elipse rotada en su lugar.
   Con zAngle = 0°, 60°, 120° se obtienen 3 elipses identicas rotadas a 60° una
   de otra → simetria 3-fold en pantalla = simbolo del atomo. */
function PlanetRings() {
  return (
    <group>
      {RING_Z_ANGLES.map((zAngle, i) => (
        <group key={i} rotation={[0, 0, zAngle]}>
          <mesh rotation={[RING_TILT_X, 0, 0]}>
            <torusGeometry args={[RING_RADIUS, RING_TUBE, 16, 128]} />
            <meshStandardMaterial
              color={RING_COLOR}
              emissive={RING_EMISSIVE}
              emissiveIntensity={0.65}
              metalness={0.9}
              roughness={0.35}
              transparent
              opacity={0.92}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BoxStar({ progressRef }: BoxStarProps) {
  /* Tilt en X del grupo + offset Y negativo:
     - tilt inclina la formacion hacia atrás (perspectiva isométrica suave).
     - GROUP_Y_OFFSET baja toda la composición para que no se solape
       con el texto del pilar.
     `lateralRef` agrupa anillos + cajas y aplica el offset izq/der por pilar
     una sola vez (asi los anillos siguen a las cajas en cada cambio de pilar). */
  const lateralRef = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const group = lateralRef.current;
    if (!group) return;

    const p = progressRef.current;
    const t = THREE.MathUtils.clamp(
      (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
      0,
      1
    );
    const activeIndex = t * PILLAR_COUNT;
    const currentPillar = Math.min(Math.floor(activeIndex), PILLAR_COUNT - 1);
    const tInPillar = activeIndex - currentPillar;

    const signNow = pillarSign(currentPillar);
    const signNext = currentPillar < PILLAR_COUNT - 1
      ? pillarSign(currentPillar + 1)
      : signNow;
    const transitionT = THREE.MathUtils.smoothstep(
      tInPillar,
      TRANSITION_START,
      TRANSITION_END
    );
    const signLerped = THREE.MathUtils.lerp(signNow, signNext, transitionT);
    const offsetMagnitude = state.viewport.width / OFFSET_DIVISOR;
    const targetX = signLerped * offsetMagnitude;

    const k = 1 - Math.exp(-dt * POSITION_DAMP);
    group.position.x += (targetX - group.position.x) * k;
  });

  return (
    <group position={[0, GROUP_Y_OFFSET, 0]} rotation={[GROUP_TILT_X, 0, 0]}>
      <group ref={lateralRef}>
        <PlanetRings />
        {BOX_SOURCES.map((src, i) => (
          <Box key={src} src={src} index={i} progressRef={progressRef} />
        ))}
      </group>
    </group>
  );
}

interface MissionBoxesProps {
  progress: MotionValue<number>;
}

export default function MissionBoxes({ progress }: MissionBoxesProps) {
  const progressRef = useRef(0);
  const isMobile = useIsMobile();

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;
  });

  return (
    <Canvas
      /* Camara elevada (Y=2.5) para mirar el anillo orbital desde arriba en
         angulo ~17° → perspectiva clara de anillo de Jupiter/Saturno con
         depth visible (boxes del frente abajo y mas grandes, las del fondo
         arriba y mas chicas). FOV bajo (36) reduce distorsion. */
      camera={{ position: [0, 2.5, 9], fov: 36 }}
      dpr={isMobile ? 1 : [1, 1.5]}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 6, 5]} intensity={1.6} color="#ffd9b8" />
      {!isMobile && (
        <>
          <directionalLight position={[-4, -2, -3]} intensity={0.55} color="#5da3ff" />
          <pointLight position={[0, 0, 5]} intensity={0.5} color="#ffffff" />
        </>
      )}

      <Suspense fallback={null}>
        <BoxStar progressRef={progressRef} />
      </Suspense>
    </Canvas>
  );
}
