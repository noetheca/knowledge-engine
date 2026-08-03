import { satteri } from "@astrojs/markdown-satteri";
import {
  ARTICLE_MARKDOWN_FEATURES,
  createArticleDirectivePlugin,
} from "./directives.js";

export function createArticleMarkdownProcessor(): ReturnType<typeof satteri> {
  return satteri({
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
  });
}
