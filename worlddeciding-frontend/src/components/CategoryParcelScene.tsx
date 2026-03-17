import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Category } from '@/entities/category/model/types'

type Props = {
  categories: Category[]
  activeId: string | null
  onSelect: (categoryId: string) => void
}

export default function CategoryParcelScene({ categories, activeId, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const hoveredIndexRef = useRef<number | null>(null)
  const activeIdRef = useRef<string | null>(activeId)
  const updateColorsRef = useRef<((hoverIndex: number | null) => void) | null>(null)

  const categoryData = useMemo(
    () =>
      categories.map((category, index) => ({
        ...category,
        index,
      })),
    [categories]
  )

  useEffect(() => {
    activeIdRef.current = activeId
    updateColorsRef.current?.(hoveredIndexRef.current)
  }, [activeId])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 800
    const height = mount.clientHeight || 420

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xd8ecff, 10, 44)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120)
    camera.position.set(0, 18, 6)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(new THREE.Color(0xe7f0ff), 0)
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95)
    keyLight.position.set(10, 14, 6)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0x22d3ee, 0.9, 40)
    rimLight.position.set(-8, 6, -10)
    scene.add(rimLight)
    const magentaLight = new THREE.PointLight(0x7c3aed, 0.6, 45)
    magentaLight.position.set(6, 10, -6)
    scene.add(magentaLight)

    const count = categoryData.length
    const cols = Math.max(3, Math.ceil(Math.sqrt(Math.max(count, 1))))
    const rows = Math.max(2, Math.ceil(Math.max(count, 1) / cols))
    const gap = 1.95
    const geometry = new THREE.BoxGeometry(1.6, 0.42, 1.6)
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf8fbff),
      roughness: 0.45,
      metalness: 0.18,
      transparent: true,
      opacity: 0.92,
      emissive: new THREE.Color(0x1f6feb),
      emissiveIntensity: 0.15,
      vertexColors: true,
    })

    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1))
    const color = new THREE.Color()
    const dummy = new THREE.Object3D()
    const tiles: Array<{ x: number; z: number; seed: number; id: string; sprite?: THREE.Sprite }> = []
    const baseColors: THREE.Color[] = []
    const hoverColor = new THREE.Color(0x38bdf8)
    const activeColor = new THREE.Color(0x22d3ee)

    let index = 0
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (index >= Math.max(count, 1)) break
        const x = (c - (cols - 1) / 2) * gap
        const z = (r - (rows - 1) / 2) * gap
        const seed = Math.random() * Math.PI * 2
        const id = categoryData[index]?.id ?? `empty-${index}`
        tiles.push({ x, z, seed, id })

        color.setHSL(0.56 + c * 0.01 - r * 0.01, 0.75, 0.85)
        mesh.setColorAt(index, color)
        baseColors.push(color.clone())
        index += 1
      }
    }

    scene.add(mesh)
    hoveredIndexRef.current = null

    const emojiGroup = new THREE.Group()
    const emojiSprites: Array<THREE.Sprite | null> = []
    const emojiScale = 1.4
    for (let i = 0; i < Math.max(count, 1); i += 1) {
      const category = categoryData[i]
      if (!category) {
        emojiSprites.push(null)
        continue
      }
      const emoji = getCategoryEmoji(category)
      const sprite = createEmojiSprite(emoji)
      sprite.scale.set(emojiScale, emojiScale, 1)
      emojiGroup.add(sprite)
      emojiSprites.push(sprite)
      tiles[i].sprite = sprite
    }
    scene.add(emojiGroup)

    const labelSprite = createLabelSprite('')
    labelSprite.visible = false
    scene.add(labelSprite)

    const updateLabel = (text: string, position?: THREE.Vector3) => {
      if (!text) {
        labelSprite.visible = false
        return
      }
      updateLabelSprite(labelSprite, text)
      if (position) labelSprite.position.copy(position)
      labelSprite.visible = true
    }

    const planeW = cols * gap + 8
    const planeH = rows * gap + 8
    const basePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xd8ecff),
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: 0.78,
      })
    )
    basePlane.rotation.x = -Math.PI / 2
    basePlane.position.y = -0.45
    scene.add(basePlane)

    const ringRadius = Math.max(planeW, planeH) * 0.24
    const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + 0.3, 64)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x38bdf8),
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.3
    scene.add(ring)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const idToIndex = new Map(categoryData.map((category, idx) => [category.id, idx]))

    const updateColors = (nextHover: number | null) => {
      const activeIndex = activeIdRef.current ? idToIndex.get(activeIdRef.current) ?? -1 : -1
      for (let i = 0; i < baseColors.length; i += 1) {
        if (i === activeIndex) {
          mesh.setColorAt(i, activeColor)
        } else if (i === nextHover) {
          mesh.setColorAt(i, hoverColor)
        } else {
          mesh.setColorAt(i, baseColors[i])
        }
      }
      mesh.instanceColor!.needsUpdate = true
    }
    updateColorsRef.current = updateColors

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObject(mesh, false)
      if (hits.length && typeof hits[0].instanceId === 'number') {
        const next = hits[0].instanceId
        if (next !== hoveredIndexRef.current) {
          hoveredIndexRef.current = next
          updateColors(hoveredIndexRef.current)
          const tile = tiles[next]
          const hoverPos = new THREE.Vector3(tile.x, 0.85, tile.z)
          updateLabel(categoryData[next]?.name ?? '', hoverPos)
        }
      } else if (hoveredIndexRef.current !== null) {
        hoveredIndexRef.current = null
        updateColors(null)
        updateLabel('')
      }
    }

    const handlePointerLeave = () => {
      hoveredIndexRef.current = null
      updateColors(null)
      updateLabel('')
    }

    const handleClick = () => {
      if (hoveredIndexRef.current === null) return
      const category = categoryData[hoveredIndexRef.current]
      if (category?.id) onSelect(category.id)
    }

    if (count > 0) {
      updateColors(null)
      mount.addEventListener('pointermove', handlePointerMove)
      mount.addEventListener('pointerleave', handlePointerLeave)
      mount.addEventListener('click', handleClick)
    }

    const introStart = performance.now()
    const animate = (time: number) => {
      animationRef.current = requestAnimationFrame(animate)
      const intro = Math.min(1, (time - introStart) / 1400)
      const introEase = 1 - Math.pow(1 - intro, 3)
      const t = time * 0.0006
      tiles.forEach((tile, i) => {
        const wave = Math.sin(t + tile.seed + tile.x * 0.35 + tile.z * 0.35) * 0.12
        const lift = wave + (1 - introEase) * -0.6
        dummy.position.set(tile.x, lift, tile.z)
        dummy.rotation.y = Math.sin(t * 0.6 + tile.seed) * 0.15
        const scale = 0.4 + 0.6 * introEase
        dummy.scale.set(scale, scale, scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        const sprite = tile.sprite
        if (sprite) {
          sprite.position.set(tile.x, lift + 0.6, tile.z)
        }
      })
      if (labelSprite.visible && hoveredIndexRef.current !== null) {
        const tile = tiles[hoveredIndexRef.current]
        labelSprite.position.set(tile.x, 1.25, tile.z)
      }
      ring.rotation.z = t * 0.2
      mesh.instanceMatrix.needsUpdate = true
      renderer.render(scene, camera)
    }
    animate(0)

    const handleResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
      mount.removeEventListener('pointermove', handlePointerMove)
      mount.removeEventListener('pointerleave', handlePointerLeave)
      mount.removeEventListener('click', handleClick)
      updateColorsRef.current = null
      geometry.dispose()
      material.dispose()
      basePlane.geometry.dispose()
      ;(basePlane.material as THREE.Material).dispose()
      emojiSprites.forEach((sprite) => sprite?.material.dispose())
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [categoryData, onSelect])

  return <div className="category-parcel-canvas" ref={mountRef} />
}

const CATEGORY_EMOJIS: Record<string, string> = {
  cars: '🚗',
  lifestyle: '💙',
  politics: '🏛️',
  sports: '⚽',
  technology: '🧠',
}

function getCategoryEmoji(category: Category) {
  const key = category.slug?.toLowerCase() || category.name?.toLowerCase()
  if (key && CATEGORY_EMOJIS[key]) return CATEGORY_EMOJIS[key]
  return '✨'
}

function createEmojiSprite(emoji: string) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  ctx.font = `72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, size / 2, size / 2 + 6)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  return new THREE.Sprite(material)
}

function createLabelSprite(text: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  updateLabelSprite(sprite, text)
  return sprite
}

function updateLabelSprite(sprite: THREE.Sprite, text: string) {
  const texture = sprite.material.map as THREE.CanvasTexture
  const canvas = texture.image as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.font = `600 26px "Space Grotesk", sans-serif`
  const paddingX = 24
  const paddingY = 16
  const textWidth = Math.ceil(ctx.measureText(text).width)
  const width = Math.min(canvas.width, textWidth + paddingX * 2)
  const height = 64

  ctx.fillStyle = 'rgba(8,16,28,0.72)'
  drawRoundedRect(ctx, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height, 18)
  ctx.fill()

  ctx.strokeStyle = 'rgba(56,189,248,0.6)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)

  texture.needsUpdate = true
  sprite.scale.set(width / 42, height / 42, 1)
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}
