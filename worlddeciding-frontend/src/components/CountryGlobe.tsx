import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Color, Object3D } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import countriesGeoJsonRaw from '@/data/countries.geojson?raw'

type CountryDatum = { countryCode: string; count: number; percentage: number }
type MarkerPoint = CountryDatum & { coord: { lat: number; lng: number } }
type CountryFeature = {
  id?: string
  properties?: { name?: string | null } | null
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | null
}
type CountryFeatureCollection = {
  features: CountryFeature[]
}

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  US: { lat: 38, lng: -97 },
  CA: { lat: 56, lng: -96 },
  GB: { lat: 55, lng: -3 },
  FR: { lat: 44.7, lng: 2 },
  DE: { lat: 51, lng: 9 },
  IT: { lat: 42.5, lng: 12.5 },
  ES: { lat: 40, lng: -4 },
  TR: { lat: 39, lng: 35 },
  RU: { lat: 60, lng: 90 },
  CN: { lat: 35, lng: 103 },
  JP: { lat: 36, lng: 138 },
  KR: { lat: 36, lng: 128 },
  IN: { lat: 21, lng: 78 },
  BR: { lat: -10, lng: -55 },
  MX: { lat: 23, lng: -102 },
  AR: { lat: -34, lng: -64 },
  AU: { lat: -25, lng: 133 },
  NZ: { lat: -41, lng: 174 },
  ZA: { lat: -30, lng: 25 },
  NG: { lat: 9, lng: 8 },
  EG: { lat: 26, lng: 30 },
  KE: { lat: 0, lng: 37 },
  SA: { lat: 24, lng: 45 },
  AE: { lat: 24, lng: 54 },
  SE: { lat: 62, lng: 16 },
  NO: { lat: 65, lng: 11 },
  FI: { lat: 64, lng: 26 },
  NL: { lat: 52.1, lng: 5.3 },
  BE: { lat: 50.5, lng: 4.7 },
  PL: { lat: 52, lng: 19 },
  UA: { lat: 49, lng: 32 },
  GR: { lat: 39, lng: 22 },
  PT: { lat: 39.5, lng: -8 },
  CH: { lat: 47, lng: 8 },
  AT: { lat: 47.5, lng: 14.5 },
  HU: { lat: 47, lng: 19 },
  CZ: { lat: 49.8, lng: 15.5 },
  DK: { lat: 56, lng: 10 },
  IE: { lat: 53, lng: -8 },
  IL: { lat: 31, lng: 35 },
  PK: { lat: 30, lng: 70 },
  BD: { lat: 24, lng: 90 },
  TH: { lat: 15, lng: 101 },
  VN: { lat: 16, lng: 108 },
  SG: { lat: 1.35, lng: 103.8 },
  ID: { lat: -5, lng: 120 },
  PH: { lat: 13, lng: 122 },
  CO: { lat: 4, lng: -73 },
  CL: { lat: -30, lng: -71 },
}

const COUNTRY_NAME_ALIASES: Record<string, string[]> = {
  TR: ['Turkey', 'Turkiye', 'Türkiye'],
  US: ['United States', 'United States of America', 'USA'],
  GB: ['United Kingdom', 'Great Britain', 'UK'],
  RU: ['Russia', 'Russian Federation'],
  CZ: ['Czechia', 'Czech Republic'],
  KR: ['South Korea', 'Republic of Korea', 'Korea, Republic of'],
  KP: ['North Korea', "Democratic People's Republic of Korea"],
  VN: ['Vietnam', 'Viet Nam'],
  CI: ["Cote d'Ivoire", "Côte d'Ivoire", 'Ivory Coast'],
  CD: ['Democratic Republic of the Congo', 'Congo (Kinshasa)'],
  CG: ['Republic of the Congo', 'Congo (Brazzaville)', 'Congo'],
  IR: ['Iran', 'Iran, Islamic Republic of'],
  SY: ['Syria', 'Syrian Arab Republic'],
  TZ: ['Tanzania', 'United Republic of Tanzania'],
  LA: ['Laos', "Lao People's Democratic Republic"],
  MD: ['Moldova', 'Republic of Moldova'],
  VE: ['Venezuela', 'Venezuela, Bolivarian Republic of'],
  BO: ['Bolivia', 'Bolivia, Plurinational State of'],
  BN: ['Brunei', 'Brunei Darussalam'],
  PS: ['Palestine', 'State of Palestine'],
  TW: ['Taiwan', 'Taiwan, Province of China'],
  MK: ['North Macedonia', 'Macedonia'],
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

type Props = { data: CountryDatum[] }

export default function CountryGlobe({ data }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const markersRef = useRef<any>(null)
  const boundariesRef = useRef<any>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animationRef = useRef<number | null>(null)

  const regionDisplayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      return null
    }
  }, [])

  const countryFeatures = useMemo(
    () => JSON.parse(countriesGeoJsonRaw) as CountryFeatureCollection,
    []
  )

  const featureCentroidsByName = useMemo(() => {
    const entries = new Map<string, { lat: number; lng: number }>()
    countryFeatures.features.forEach(feature => {
      const name = feature.properties?.name?.trim()
      if (!name || !feature.geometry) return
      const centroid = computeFeatureCentroid(feature.geometry)
      if (!centroid) return
      entries.set(normalizeCountryName(name), centroid)
    })
    return entries
  }, [countryFeatures])

  const boundaryPositions = useMemo(() => {
    const positions: number[] = []
    const radius = 14.04
    const appendRing = (ring: number[][]) => {
      for (let i = 0; i < ring.length; i++) {
        const [lng1, lat1] = ring[i]
        const [lng2, lat2] = ring[(i + 1) % ring.length]
        const a = latLngToVector3(lat1, lng1, radius)
        const b = latLngToVector3(lat2, lng2, radius)
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }

    countryFeatures.features.forEach(feature => {
      if (!feature.geometry) return
      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates.forEach(ring => appendRing(ring))
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(poly => poly.forEach(ring => appendRing(ring)))
      }
    })

    return new Float32Array(positions)
  }, [countryFeatures])

  const markerPoints = useMemo<MarkerPoint[]>(() => {
    return data
      .map(d => {
        const code = d.countryCode.trim().toUpperCase()
        return {
          ...d,
          countryCode: code,
          coord: resolveCountryCoord(code, featureCentroidsByName, regionDisplayNames),
        }
      })
      .filter((d): d is MarkerPoint => Boolean(d.coord))
  }, [data, featureCentroidsByName, regionDisplayNames])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const isLowPowerDevice =
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const width = mount.clientWidth || 640
    const height = mount.clientHeight || 420
    const globeSegments = isLowPowerDevice ? 48 : 96
    const atmosphereSegments = isLowPowerDevice ? 32 : 64
    const maxPixelRatio = isLowPowerDevice ? 1.2 : 1.75
    const starCount = isLowPowerDevice ? 140 : 600
    const targetFrameInterval = 1000 / (isLowPowerDevice ? 24 : 60)
    const rotationStep = isLowPowerDevice ? 0.0003 : 0.0005

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.set(0, 0, 46)

    const renderer = new THREE.WebGLRenderer({
      antialias: !isLowPowerDevice,
      alpha: true,
      powerPreference: isLowPowerDevice ? 'low-power' : 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio))
    renderer.setClearColor(new THREE.Color(0x0b1220), 0)
    rendererRef.current = renderer
    mount.appendChild(renderer.domElement)

    const globeGeom = new THREE.SphereGeometry(14, globeSegments, globeSegments)
    const landTexture = createLandMaskTexture(countryFeatures)
    const globeMat = new THREE.MeshPhongMaterial({
      map: landTexture,
      color: new THREE.Color(0x0b1f35),
      specular: new THREE.Color(0x38bdf8),
      shininess: 6,
      transparent: true,
      opacity: 0.98,
      emissive: new THREE.Color(0x0ea5e9).multiplyScalar(0.18),
      emissiveMap: landTexture,
    })
    const globe = new THREE.Mesh(globeGeom, globeMat)
    scene.add(globe)

    const wireGeometry = new THREE.WireframeGeometry(globeGeom)
    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0x1f2937,
      opacity: isLowPowerDevice ? 0.18 : 0.3,
      transparent: true,
    })
    const wire = new THREE.LineSegments(
      wireGeometry,
      wireMaterial
    )
    scene.add(wire)

    if (boundaryPositions.length) {
      const boundaryGeometry = new THREE.BufferGeometry()
      boundaryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(boundaryPositions, 3))
      const boundaryMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(0xe0f2ff),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
      const boundaryLines = new THREE.LineSegments(boundaryGeometry, boundaryMaterial)
      boundaryLines.rotation.y = globe.rotation.y
      boundaryLines.renderOrder = 3
      boundariesRef.current = boundaryLines
      scene.add(boundaryLines)
    }

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(14.4, atmosphereSegments, atmosphereSegments),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x38bdf8),
        transparent: true,
        opacity: 0.08,
      })
    )
    scene.add(atmosphere)

    const ambient = new THREE.AmbientLight(0xffffff, 0.95)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 0.9)
    dir.position.set(12, 10, 10)
    scene.add(dir)

    const starfield = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          Array.from({ length: starCount }).flatMap(() => {
            const r = 80 + Math.random() * 30
            const theta = Math.random() * 2 * Math.PI
            const phi = Math.acos(2 * Math.random() - 1)
            return [
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.cos(phi),
              r * Math.sin(phi) * Math.sin(theta),
            ]
          }),
          3
        )
      ),
      new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.2, opacity: 0.4, transparent: true })
    )
    scene.add(starfield)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = !isLowPowerDevice
    controls.enablePan = false
    controls.minDistance = 22
    controls.maxDistance = 80
    controlsRef.current = controls

    let disposed = false
    let isInViewport = true
    let isPageVisible = document.visibilityState !== 'hidden'
    let lastFrameTime = 0

    const stopAnimation = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }

    const animate = (timestamp: number) => {
      if (disposed) return
      animationRef.current = requestAnimationFrame(animate)
      if (!isInViewport || !isPageVisible) return
      if (timestamp - lastFrameTime < targetFrameInterval) return
      lastFrameTime = timestamp

      globe.rotation.y += rotationStep
      if (markersRef.current) markersRef.current.rotation.y += rotationStep
      if (boundariesRef.current) boundariesRef.current.rotation.y += rotationStep
      if (controls.enableDamping) controls.update()
      renderer.render(scene, camera)
    }

    const startAnimation = () => {
      if (disposed || animationRef.current !== null) return
      lastFrameTime = 0
      animationRef.current = requestAnimationFrame(animate)
    }

    const syncAnimation = () => {
      if (disposed) return
      if (isInViewport && isPageVisible) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const visibilityHandler = () => {
      isPageVisible = document.visibilityState !== 'hidden'
      syncAnimation()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInViewport = entry?.isIntersecting ?? true
        syncAnimation()
      },
      { threshold: 0.08 }
    )
    observer.observe(mount)
    document.addEventListener('visibilitychange', visibilityHandler)
    startAnimation()

    const handleResize = () => {
      const w = mount.clientWidth || 640
      const h = mount.clientHeight || 420
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      disposed = true
      stopAnimation()
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibilityHandler)
      window.removeEventListener('resize', handleResize)
      controls.dispose()
      globe.geometry.dispose()
      ;(globe.material as any).dispose()
      landTexture.dispose()
      wire.geometry.dispose()
      ;(wire.material as any).dispose()
      atmosphere.geometry.dispose()
      ;(atmosphere.material as any).dispose()
      starfield.geometry.dispose()
      ;(starfield.material as any).dispose()
      if (boundariesRef.current) {
        scene.remove(boundariesRef.current)
        boundariesRef.current.geometry.dispose()
        ;(boundariesRef.current.material as any).dispose()
        boundariesRef.current = null
      }
      if (markersRef.current) {
        scene.remove(markersRef.current)
        disposeMarkerGroup(markersRef.current)
        markersRef.current = null
      }
      controlsRef.current = null
      sceneRef.current = null
      rendererRef.current = null
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [boundaryPositions, countryFeatures])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (markersRef.current) {
      scene.remove(markersRef.current)
      disposeMarkerGroup(markersRef.current)
      markersRef.current = null
    }

    if (!markerPoints.length) return

    const markerGroup = new THREE.Group()
    const glowTexture = createGlowTexture()
    const ringUp = new THREE.Vector3(0, 0, 1)
    const worldUp = new THREE.Vector3(0, 1, 0)

    const maxPercentage = Math.max(...markerPoints.map(p => p.percentage || 0), 1)
    const isCompactViewport =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 1200px)').matches)

    markerPoints.forEach((pt, index) => {
      const { lat, lng } = pt.coord
      const surfacePos = latLngToVector3(lat, lng, 14)
      const normal = surfacePos.clone().normalize()
      const basePos = normal.clone().multiplyScalar(14.04)
      const t = Math.min(1, pt.percentage / 100)
      const color = new THREE.Color().lerpColors(new THREE.Color(0x38bdf8), new THREE.Color(0xf472b6), t)
      const strength = Math.max(0.55, pt.percentage / maxPercentage)

      const ringGeom = new THREE.RingGeometry(0.24, 0.5 + strength * 0.35, 36)
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      ring.position.copy(basePos)
      ring.quaternion.setFromUnitVectors(ringUp, normal)

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        })
      )
      const glowScale = 1.2 + strength * 1.8
      glow.position.copy(normal.clone().multiplyScalar(14.12))
      glow.scale.set(glowScale, glowScale, glowScale)

      markerGroup.add(ring, glow)

      const label = createLabelSprite(
        pt.countryCode.toUpperCase(),
        Math.round(pt.percentage),
        color,
        markerPoints.length,
        isCompactViewport
      )
      const tangent = new THREE.Vector3().crossVectors(worldUp, normal)
      if (tangent.lengthSq() < 0.0001) tangent.set(1, 0, 0)
      tangent.normalize()
      const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize()
      const ringIndex = index % 4
      const radialDistance = 15 + ringIndex * 0.24
      const lateralOffset = (markerPoints.length > 10 ? 0.28 : 0.18) * (index % 2 === 0 ? 1 : -1)
      const verticalOffset = ((index % 3) - 1) * (markerPoints.length > 12 ? 0.14 : 0.09)
      label.position
        .copy(normal.clone().multiplyScalar(radialDistance))
        .add(tangent.multiplyScalar(lateralOffset))
        .add(bitangent.multiplyScalar(verticalOffset))
      const labelScale =
        markerPoints.length > 18
          ? 0.68 + strength * 0.08
          : markerPoints.length > 10
            ? 0.76 + strength * 0.1
            : 0.84 + strength * 0.12
      label.scale.multiplyScalar(labelScale)
      markerGroup.add(label)
    })

    markersRef.current = markerGroup
    scene.add(markerGroup)

    return () => {
      if (markersRef.current === markerGroup) {
        markerGroup.parent?.remove(markerGroup)
        markersRef.current = null
      }
      disposeMarkerGroup(markerGroup)
    }
  }, [markerPoints])

  return (
    <div className="globe-shell">
      <div className="globe-canvas" ref={mountRef} />
      <div className="globe-overlay">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Country votes</p>
        <p className="text-base font-semibold text-strong">3D world view</p>
      </div>
    </div>
  )
}

function resolveCountryCoord(
  countryCode: string,
  featureCentroidsByName: Map<string, { lat: number; lng: number }>,
  regionDisplayNames: Intl.DisplayNames | null
) {
  const normalizedCode = countryCode.trim().toUpperCase()
  if (!normalizedCode) return undefined

  const displayName = regionDisplayNames?.of(normalizedCode) ?? null
  const lookupNames = [
    ...(displayName ? [displayName] : []),
    ...(COUNTRY_NAME_ALIASES[normalizedCode] ?? []),
  ]

  for (const name of lookupNames) {
    const coord = featureCentroidsByName.get(normalizeCountryName(name))
    if (coord) {
      return coord
    }
  }

  return COUNTRY_COORDS[normalizedCode]
}

function normalizeCountryName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[()'’.]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function computeFeatureCentroid(
  geometry: CountryFeature['geometry']
): { lat: number; lng: number } | null {
  if (!geometry) return null

  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let found = false

  const includePoint = (lng: number, lat: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    found = true
  }

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => ring.forEach(([lng, lat]) => includePoint(lng, lat)))
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon =>
      polygon.forEach(ring => ring.forEach(([lng, lat]) => includePoint(lng, lat)))
    )
  }

  if (!found) return null
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  }
}

function createLandMaskTexture(features: CountryFeatureCollection) {
  const width = 2048
  const height = 1024
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, width, height)

  const landGradient = ctx.createLinearGradient(0, 0, width, 0)
  landGradient.addColorStop(0, 'rgba(14,165,233,0.16)')
  landGradient.addColorStop(0.5, 'rgba(14,197,255,0.18)')
  landGradient.addColorStop(1, 'rgba(14,165,233,0.16)')
  ctx.fillStyle = landGradient
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(224,242,255,0.9)'
  ctx.lineWidth = 1.2
  ctx.shadowColor = 'rgba(224,242,255,0.55)'
  ctx.shadowBlur = 7

  const project = (lng: number, lat: number) => {
    const x = ((lng + 180) / 360) * width
    const y = ((90 - lat) / 180) * height
    return { x, y }
  }

  const drawPolygonRings = (rings: number[][][]) => {
    ctx.beginPath()
    rings.forEach(ring => {
      ring.forEach(([lng, lat], idx) => {
        const { x, y } = project(lng, lat)
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
    })
    ctx.fill('evenodd')
    ctx.stroke()
  }

  features.features.forEach(feature => {
    if (!feature.geometry) return
    if (feature.geometry.type === 'Polygon') {
      drawPolygonRings(feature.geometry.coordinates)
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach(poly => drawPolygonRings(poly))
    }
  })

  ctx.shadowBlur = 0
  ctx.lineWidth = 0.9
  ctx.strokeStyle = 'rgba(148,163,184,0.4)'
  for (let lon = -180; lon <= 180; lon += 30) {
    ctx.beginPath()
    const x = ((lon + 180) / 360) * width
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let lat = -60; lat <= 80; lat += 20) {
    ctx.beginPath()
    const y = ((90 - lat) / 180) * height
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function createGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createLabelSprite(
  countryCode: string,
  percentage: number,
  color: Color,
  markerCount: number,
  isCompactViewport: boolean
) {
  const paddingX = markerCount > 16 ? 10 : 12
  const paddingY = markerCount > 16 ? 7 : 8
  const codeFontSize = markerCount > 16 ? 15 : markerCount > 10 ? 16 : 18
  const percentFontSize = markerCount > 16 ? 11 : 13
  const lineGap = markerCount > 16 ? 3 : 4
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const percentText = `${percentage}%`
  ctx.font = `700 ${codeFontSize}px "Space Grotesk", sans-serif`
  const codeWidth = Math.ceil(ctx.measureText(countryCode).width)
  ctx.font = `600 ${percentFontSize}px "Space Grotesk", sans-serif`
  const percentWidth = Math.ceil(ctx.measureText(percentText).width)
  const contentWidth = Math.max(codeWidth, percentWidth)
  const minWidth = isCompactViewport ? 68 : 78
  const width = Math.max(minWidth, contentWidth + paddingX * 2)
  const height = codeFontSize + percentFontSize + lineGap + paddingY * 2
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = 'rgba(10,18,32,0.72)'
  drawRoundedRect(ctx, 0, 0, width, height, 14)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
    color.b * 255
  )}, 0.7)`
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `700 ${codeFontSize}px "Space Grotesk", sans-serif`
  ctx.fillText(countryCode, width / 2, paddingY)
  ctx.font = `600 ${percentFontSize}px "Space Grotesk", sans-serif`
  ctx.fillStyle = 'rgba(220,236,255,0.92)'
  ctx.fillText(percentText, width / 2, paddingY + codeFontSize + lineGap)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(width / 52, height / 52, 1)
  return sprite
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

function disposeMarkerGroup(group: Object3D) {
  const anyGroup = group as any
  if (anyGroup.userData?.__disposedByApp) return
  anyGroup.userData = { ...(anyGroup.userData ?? {}), __disposedByApp: true }

  group.traverse((obj: Object3D) => {
    const anyObj = obj as any
    if (anyObj.geometry && typeof anyObj.geometry.dispose === 'function') {
      anyObj.geometry.dispose()
    }
    const material = anyObj.material
    const disposeMaterial = (mat: any) => {
      if (!mat) return
      if (mat.map && typeof mat.map.dispose === 'function') mat.map.dispose()
      if (typeof mat.dispose === 'function') mat.dispose()
    }
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else disposeMaterial(material)
  })
}
