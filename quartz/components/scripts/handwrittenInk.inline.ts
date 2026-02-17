/**
 * Handwritten Ink Renderer
 * Renders tldraw data from obsidian_ink plugin as SVG
 */

import config from "../../../quartz.config"

interface TldrawPoint {
  x: number
  y: number
  z: number // pressure
}

interface TldrawSegment {
  type: string
  points: TldrawPoint[]
}

interface TldrawDrawShape {
  id: string
  type: "draw"
  x: number
  y: number
  rotation: number
  opacity: number
  props: {
    segments: TldrawSegment[]
    color: string
    fill: string
    dash: string
    size: string
    isComplete: boolean
    isClosed: boolean
    isPen: boolean
    scale: number
  }
}

interface TldrawStore {
  [key: string]: {
    id: string
    type?: string
    typeName?: string
    x?: number
    y?: number
    rotation?: number
    opacity?: number
    props?: {
      segments?: TldrawSegment[]
      color?: string
      fill?: string
      dash?: string
      size?: string
      isComplete?: boolean
      isClosed?: boolean
      isPen?: boolean
      scale?: number
      w?: number
      h?: number
    }
    parentId?: string
    index?: string
    meta?: Record<string, unknown>
    gridSize?: number
    name?: string
  }
}

interface WritingFile {
  meta: {
    pluginVersion: string
    tldrawVersion: string
  }
  tldraw: {
    document: {
      store: TldrawStore
    }
  }
}

interface InkEmbedData {
  versionAtEmbed: string
  filepath: string
}

// Size mapping for stroke widths
const sizeMap: Record<string, number> = {
  s: 2,
  m: 3,
  l: 5,
  xl: 8,
}

// Color mapping
const colorMap: Record<string, string> = {
  black: "var(--dark)",
  white: "var(--light)",
  grey: "var(--gray)",
  blue: "#4a90d9",
  red: "#e03131",
  green: "#2f9e44",
  orange: "#e8590c",
  yellow: "#f59f00",
  purple: "#7950f2",
}

/**
 * Slugify a filepath to match Quartz's slugifyFilePath behavior
 * This transforms spaces to dashes and handles special characters
 */
function slugifyFilepath(fp: string): string {
  return fp
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
}

/**
 * Convert tldraw draw shape to SVG path data
 */
function segmentsToPathData(segments: TldrawSegment[]): string {
  let pathData = ""

  for (const segment of segments) {
    if (segment.type === "free" && segment.points.length > 0) {
      const points = segment.points

      if (points.length === 1) {
        // Single point - draw a dot
        pathData += `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y} `
      } else {
        // Start the path
        pathData += `M ${points[0].x} ${points[0].y} `

        // Use quadratic curves for smoother lines
        for (let i = 1; i < points.length - 1; i++) {
          const p0 = points[i - 1]
          const p1 = points[i]
          const p2 = points[i + 1]

          // Calculate control point for smooth curve
          const cpX = p1.x
          const cpY = p1.y
          const endX = (p1.x + p2.x) / 2
          const endY = (p1.y + p2.y) / 2

          pathData += `Q ${cpX} ${cpY} ${endX} ${endY} `
        }

        // Last segment
        if (points.length > 1) {
          const lastPoint = points[points.length - 1]
          const secondLast = points[points.length - 2]
          pathData += `L ${lastPoint.x} ${lastPoint.y} `
        }
      }
    }
  }

  return pathData
}

/**
 * Create SVG element from tldraw data
 */
function createSvgFromTldraw(tldrawData: WritingFile): SVGSVGElement | null {
  const store = tldrawData.tldraw.document.store

  // Find all draw shapes
  const drawShapes: TldrawDrawShape[] = []

  for (const key of Object.keys(store)) {
    const item = store[key]
    if (item.type === "draw" && item.props?.segments) {
      drawShapes.push(item as unknown as TldrawDrawShape)
    }
  }

  if (drawShapes.length === 0) {
    return null
  }

  // Calculate bounds
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const shape of drawShapes) {
    for (const segment of shape.props.segments) {
      for (const point of segment.points) {
        const x = shape.x + point.x
        const y = shape.y + point.y
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  // Add padding
  const padding = 20
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  const width = maxX - minX
  const height = maxY - minY

  // Create SVG
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`)
  svg.setAttribute("width", "100%")
  svg.setAttribute("height", "auto")
  svg.setAttribute("class", "handwritten-ink-svg")
  svg.style.maxHeight = "500px"

  // Create paths for each draw shape
  for (const shape of drawShapes) {
    const pathData = segmentsToPathData(shape.props.segments)

    if (pathData) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", pathData)
      path.setAttribute("fill", "none")
      path.setAttribute("stroke", colorMap[shape.props.color] || shape.props.color || "currentColor")
      path.setAttribute("stroke-width", String(sizeMap[shape.props.size] || 3))
      path.setAttribute("stroke-linecap", "round")
      path.setAttribute("stroke-linejoin", "round")
      path.setAttribute("opacity", String(shape.opacity ?? 1))

      // Apply transform for shape position
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g")
      g.setAttribute("transform", `translate(${shape.x}, ${shape.y})`)
      g.appendChild(path)

      svg.appendChild(g)
    }
  }

  return svg
}

/**
 * Fetch and render a .writing file
 */
async function renderHandwrittenInk(
  container: HTMLElement,
  filepath: string,
): Promise<void> {
  try {
    // Slugify the filepath to match how Quartz copies assets
    const slugifiedPath = slugifyFilepath(filepath)

    // Construct the URL to the .writing file
    // The filepath is relative to the content directory
    const url = `/${slugifiedPath}`

    const response = await fetch(config.configuration.baseUrl + url)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }

    const tldrawData: WritingFile = await response.json()
    const svg = createSvgFromTldraw(tldrawData)

    if (svg) {
      container.innerHTML = ""
      container.appendChild(svg)
    } else {
      container.innerHTML = '<p class="handwritten-ink-error">No drawing data found</p>'
    }
  } catch (error) {
    console.error("Error rendering handwritten ink:", error)
    container.innerHTML = `<p class="handwritten-ink-error">Failed to load ink: ${error}</p>`
  }
}

// Initialize on page load
document.addEventListener("nav", async () => {
  const inkBlocks = document.querySelectorAll("code.handwritten-ink") as NodeListOf<HTMLElement>

  if (inkBlocks.length === 0) return

  for (const block of inkBlocks) {
    try {
      const inkDataStr = block.getAttribute("data-ink-data")
      if (!inkDataStr) continue

      const inkData: InkEmbedData = JSON.parse(inkDataStr)
      if (!inkData.filepath) continue

      // Create a container for the SVG
      const container = document.createElement("div")
      container.className = "handwritten-ink-container"
      container.setAttribute("data-filepath", inkData.filepath)

      // Replace the code block with the container
      const parent = block.parentElement
      if (parent) {
        parent.insertBefore(container, block)
        block.style.display = "none"
      }

      // Render the ink
      await renderHandwrittenInk(container, inkData.filepath)
    } catch (error) {
      console.error("Error parsing ink data:", error)
    }
  }
})
