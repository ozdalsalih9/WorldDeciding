declare module 'three/examples/jsm/controls/OrbitControls' {
  export class OrbitControls {
    constructor(object: any, domElement?: any)
    enableDamping: boolean
    enablePan: boolean
    minDistance: number
    maxDistance: number
    update(): void
    dispose(): void
  }
}

declare module '*.geojson' {
  const value: any
  export default value
}

declare module '*.geojson?raw' {
  const value: string
  export default value
}
