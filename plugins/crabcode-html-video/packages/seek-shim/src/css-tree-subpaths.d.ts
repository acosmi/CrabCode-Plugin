// css-tree exposes parser/walker runtime subpaths, while @types/css-tree 2.x
// publishes declarations only for the package root. Re-export the matching
// root declarations so the runtime can stay on the data-free subpaths without
// weakening strict TypeScript checks.
declare module 'css-tree/parser' {
  import { parse as parseCss } from 'css-tree'

  const parse: typeof parseCss
  export default parse
}

declare module 'css-tree/walker' {
  import { walk as walkCss } from 'css-tree'

  const walk: typeof walkCss
  export default walk
}
