'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const BASE_COLOR = 0x4a5a52

const MESH_MUSCLES: Record<string, string[]> = {
  torso_upper: ['chest', 'back', 'shoulders'],
  torso_lower: ['core'],
  pelvis:      ['glutes', 'hip_flexors'],
  shoulder_l:  ['shoulders'],
  shoulder_r:  ['shoulders'],
  upper_arm_l: ['biceps', 'triceps'],
  upper_arm_r: ['biceps', 'triceps'],
  forearm_l:   [],
  forearm_r:   [],
  thigh_l:     ['quads', 'hamstrings'],
  thigh_r:     ['quads', 'hamstrings'],
  shin_l:      ['calves'],
  shin_r:      ['calves'],
}

function emissiveFor(name: string, intensities: Record<string, number>) {
  const muscles = MESH_MUSCLES[name]
  if (!muscles?.length) return { hex: 0x000000, intensity: 0 }
  const avg = muscles.reduce((s, m) => s + (intensities[m] ?? 0), 0) / muscles.length
  if (avg >= 0.6) return { hex: 0xd5ff5f, intensity: 0.3 }
  if (avg >= 0.3) return { hex: 0x888800, intensity: 0.15 }
  return { hex: 0x000000, intensity: 0 }
}

function buildFigure(intensities: Record<string, number>): THREE.Group {
  const group = new THREE.Group()

  function makeMesh(geo: THREE.BufferGeometry, name: string): THREE.Mesh {
    const em = emissiveFor(name, intensities)
    const mat = new THREE.MeshStandardMaterial({
      color: BASE_COLOR,
      roughness: 0.65,
      metalness: 0.05,
      emissive: new THREE.Color(em.hex),
      emissiveIntensity: em.intensity,
    })
    const m = new THREE.Mesh(geo, mat)
    m.name = name
    return m
  }

  function place(m: THREE.Mesh, x: number, y: number, z = 0, rz = 0): THREE.Mesh {
    m.position.set(x, y, z)
    if (rz) m.rotation.z = rz
    group.add(m)
    return m
  }

  place(makeMesh(new THREE.SphereGeometry(0.165, 16, 12), 'head'), 0, 0.95)
  place(makeMesh(new THREE.CylinderGeometry(0.08, 0.095, 0.18, 10), 'neck'), 0, 0.76)
  place(makeMesh(new THREE.BoxGeometry(0.70, 0.55, 0.26), 'torso_upper'), 0, 0.36)
  place(makeMesh(new THREE.BoxGeometry(0.50, 0.32, 0.24), 'torso_lower'), 0, -0.08)
  place(makeMesh(new THREE.BoxGeometry(0.52, 0.20, 0.24), 'pelvis'), 0, -0.32)

  const sGeo = new THREE.SphereGeometry(0.175, 12, 10)
  place(makeMesh(sGeo, 'shoulder_l'), -0.41, 0.52)
  place(makeMesh(sGeo.clone(), 'shoulder_r'), 0.41, 0.52)

  const uaGeo = new THREE.CylinderGeometry(0.105, 0.095, 0.42, 10)
  place(makeMesh(uaGeo, 'upper_arm_l'), -0.54, 0.22, 0, 0.12)
  place(makeMesh(uaGeo.clone(), 'upper_arm_r'), 0.54, 0.22, 0, -0.12)

  const eGeo = new THREE.SphereGeometry(0.088, 10, 8)
  place(makeMesh(eGeo, 'elbow_l'), -0.60, -0.02)
  place(makeMesh(eGeo.clone(), 'elbow_r'), 0.60, -0.02)

  const faGeo = new THREE.CylinderGeometry(0.085, 0.070, 0.40, 10)
  place(makeMesh(faGeo, 'forearm_l'), -0.64, -0.27, 0, 0.07)
  place(makeMesh(faGeo.clone(), 'forearm_r'), 0.64, -0.27, 0, -0.07)

  const hGeo = new THREE.SphereGeometry(0.078, 8, 6)
  place(makeMesh(hGeo, 'hand_l'), -0.66, -0.51)
  place(makeMesh(hGeo.clone(), 'hand_r'), 0.66, -0.51)

  const hipGeo = new THREE.SphereGeometry(0.150, 10, 8)
  place(makeMesh(hipGeo, 'hip_l'), -0.21, -0.35)
  place(makeMesh(hipGeo.clone(), 'hip_r'), 0.21, -0.35)

  const thGeo = new THREE.CylinderGeometry(0.135, 0.115, 0.50, 10)
  place(makeMesh(thGeo, 'thigh_l'), -0.21, -0.60)
  place(makeMesh(thGeo.clone(), 'thigh_r'), 0.21, -0.60)

  const kGeo = new THREE.SphereGeometry(0.105, 10, 8)
  place(makeMesh(kGeo, 'knee_l'), -0.21, -0.87)
  place(makeMesh(kGeo.clone(), 'knee_r'), 0.21, -0.87)

  const shGeo = new THREE.CylinderGeometry(0.095, 0.076, 0.40, 10)
  place(makeMesh(shGeo, 'shin_l'), -0.21, -1.02)
  place(makeMesh(shGeo.clone(), 'shin_r'), 0.21, -1.02)

  const fGeo = new THREE.SphereGeometry(0.09, 8, 6)
  const footL = makeMesh(fGeo, 'foot_l')
  footL.scale.set(1.0, 0.5, 1.5)
  place(footL, -0.21, -1.25, 0.04)
  const footR = makeMesh(fGeo.clone(), 'foot_r')
  footR.scale.set(1.0, 0.5, 1.5)
  place(footR, 0.21, -1.25, 0.04)

  return group
}

type Props = {
  intensities: Record<string, number>
  height?: number
}

export default function MuscleAvatarCanvas({ intensities, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer | null
    rafId: number
    ro: ResizeObserver | null
  }>({ renderer: null, rafId: 0, ro: null })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const s = stateRef.current
    const w = container.clientWidth || 320

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x101010)

    const camera = new THREE.PerspectiveCamera(45, w / height, 0.1, 100)
    camera.position.set(0, 0.12, 3.9)
    camera.lookAt(0, 0.0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    s.renderer = renderer

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 0.85)
    dir.position.set(2, 4, 2)
    scene.add(dir)
    const fill = new THREE.DirectionalLight(0x6699cc, 0.3)
    fill.position.set(-2, 1, 2)
    scene.add(fill)

    const figure = buildFigure(intensities)
    scene.add(figure)

    const ro = new ResizeObserver(() => {
      if (!s.renderer) return
      const nw = container.clientWidth
      s.renderer.setSize(nw, height)
      camera.aspect = nw / height
      camera.updateProjectionMatrix()
    })
    ro.observe(container)
    s.ro = ro

    let running = true
    const animate = () => {
      if (!running) return
      s.rafId = requestAnimationFrame(animate)
      figure.rotation.y += 0.004
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      running = false
      cancelAnimationFrame(s.rafId)
      s.ro?.disconnect()
      s.ro = null
      s.renderer = null
      renderer.dispose()
      try { renderer.domElement.parentNode?.removeChild(renderer.domElement) } catch { /* noop */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 14, overflow: 'hidden', background: '#101010' }}
    />
  )
}
