import {
  canonicalEditorDraft,
  renderArticleDocument,
  renderArticleMarkdown
} from "./editor-document.ts";

export const articlePreviewDocument = renderArticleDocument(canonicalEditorDraft);
export const articlePreviewMarkdown = renderArticleMarkdown(canonicalEditorDraft);
