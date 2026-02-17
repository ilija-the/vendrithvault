import { QuartzTransformerPlugin } from "../types"
import { Code } from "mdast"
import { visit } from "unist-util-visit"
import { Root } from "mdast"
import { CSSResource } from "../../util/resources"
import { BuildCtx } from "../../util/ctx"
// @ts-ignore
import handwrittenInkScript from "../../components/scripts/handwrittenInk.inline"
import handwrittenInkStyle from "../../components/styles/handwrittenInk.inline.scss"

export interface Options {
  enabled: boolean
}

const defaultOptions: Options = {
  enabled: true,
}

// Supported ink code block languages
const INK_LANGUAGES = ["handwritten-ink", "handdrawn-ink"]

export const HandwrittenInk: QuartzTransformerPlugin<Partial<Options>> = (opts) => {
  const options = { ...defaultOptions, ...opts }

  return {
    name: "HandwrittenInk",
    markdownPlugins(_ctx: BuildCtx) {
      return [
        () => {
          return (tree: Root, file) => {
            visit(tree, "code", (node: Code) => {
              if (node.lang && INK_LANGUAGES.includes(node.lang)) {
                file.data.hasHandwrittenInk = true
                node.data = {
                  hProperties: {
                    className: [node.lang],
                    "data-ink-data": node.value,
                  },
                }
              }
            })
          }
        },
      ]
    },
    htmlPlugins(_ctx: BuildCtx) {
      return []
    },
    externalResources(_ctx: BuildCtx) {
      if (!options.enabled) return undefined
      return {
        js: [
          {
            script: handwrittenInkScript,
            loadTime: "afterDOMReady",
            contentType: "inline",
          },
        ],
        css: [
          {
            content: handwrittenInkStyle,
            inline: true,
          } as CSSResource,
        ],
      }
    },
  }
}
