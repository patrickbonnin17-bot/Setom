from pathlib import Path

main = Path("src/main.jsx")
text = main.read_text(encoding="utf-8")
old = 'return <div className="modal-bg"><div className="modal os-detail-modal">'
new = 'return <div className="modal-bg os-modal-backdrop"><div className="modal os-detail-modal">'
if old not in text:
    raise SystemExit("SETOM: OS modal root not found")
text = text.replace(old, new, 1)
main.write_text(text, encoding="utf-8")

css = Path("src/style.css")
style = css.read_text(encoding="utf-8")
marker = "/* SETOM FINAL OS SCROLL CONTAINER */"
if marker not in style:
    style += r'''

/* SETOM FINAL OS SCROLL CONTAINER */
/* The OS dossier is a self-contained sheet. The backdrop never scrolls; the
   white dossier owns the complete vertical gesture/wheel interaction. */
.os-modal-backdrop {
  overflow: hidden !important;
  touch-action: none !important;
  overscroll-behavior: none !important;
}

.os-modal-backdrop > .os-detail-modal {
  width: min(900px, calc(100vw - 30px)) !important;
  height: calc(100dvh - 30px) !important;
  max-height: calc(100dvh - 30px) !important;
  min-height: 0 !important;
  overflow-y: scroll !important;
  overflow-x: hidden !important;
  overscroll-behavior-y: contain !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: pan-y !important;
  scrollbar-gutter: stable;
  align-self: center;
}

.os-modal-backdrop > .os-detail-modal .os-tab-content {
  min-height: 0;
}

@media (max-width: 700px) {
  .os-modal-backdrop {
    align-items: flex-start !important;
    justify-content: center !important;
    padding: 6px !important;
  }

  .os-modal-backdrop > .os-detail-modal {
    width: 100% !important;
    height: calc(100dvh - 12px) !important;
    max-height: calc(100dvh - 12px) !important;
    border-radius: 16px !important;
    padding: 16px !important;
  }
}
'''
css.write_text(style, encoding="utf-8")
print("SETOM: final OS scroll container applied")
