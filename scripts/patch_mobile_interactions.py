from pathlib import Path

path = Path("src/style.css")
text = path.read_text(encoding="utf-8")

marker = "/* SETOM INTERACTION STABILITY */"
if marker not in text:
    text += r'''

/* SETOM INTERACTION STABILITY */
/* Keep the OS detail sheet above navigation/visual layers and make its controls
   reliably reachable on touch devices. */
.os-detail-modal,
.os-detail-modal * {
  -webkit-tap-highlight-color: transparent;
}

.os-detail-modal {
  position: relative;
  z-index: 2147483002;
  isolation: isolate;
}

.os-detail-modal input,
.os-detail-modal select,
.os-detail-modal textarea,
.os-detail-modal button,
.os-detail-modal label {
  position: relative;
  z-index: 2;
  pointer-events: auto !important;
}

.os-tabs {
  position: relative;
  z-index: 5;
  isolation: isolate;
  touch-action: pan-x;
}

.os-tab {
  position: relative;
  z-index: 6;
  pointer-events: auto !important;
  touch-action: manipulation;
}

/* On phones, show all OS tabs without forcing the user to horizontally hunt
   for Travaux, Planning, Constat, etc. */
@media (max-width: 700px) {
  .os-tabs {
    overflow-x: visible;
    overflow-y: visible;
    flex-wrap: wrap;
    gap: 7px;
  }

  .os-tab {
    flex: 1 1 calc(50% - 7px);
    min-width: 0;
    min-height: 44px;
    justify-content: center;
  }
}

/* Inputs must remain visually and physically usable in the operational sheet. */
.os-work-card input:not([type="file"]),
.os-work-card select,
.os-work-card textarea {
  pointer-events: auto !important;
  user-select: text !important;
  -webkit-user-select: text !important;
}
'''

# Mobile OS detail sheet: it must be the vertical scroll container while the
# page behind it remains locked. This is especially important on iOS, where a
# fixed overlay with an unconstrained child can swallow the touch gesture.
scroll_marker = "/* SETOM MOBILE OS SHEET SCROLL FIX */"
if scroll_marker not in text:
    text += r'''

/* SETOM MOBILE OS SHEET SCROLL FIX */
@media (max-width: 700px) {
  .modal-bg,
  .modal-overlay {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .modal-bg > .modal,
  .modal-overlay > .modal,
  .os-detail-modal {
    max-height: calc(100dvh - 12px) !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior-y: contain;
    touch-action: pan-y !important;
  }

  .os-detail-modal {
    width: 100%;
    min-height: 0;
  }

  .os-detail-modal input[type="file"] {
    touch-action: manipulation;
  }
}
'''

path.write_text(text, encoding="utf-8")
print("SETOM: mobile tabs, form controls and OS sheet scrolling stabilized")
