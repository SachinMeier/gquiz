# Test Audit

## Testable Behaviors

### High-value automated checks
- App bootstraps successfully when `data/cards.json` and `data/countries.json` load.
- Failed card-data fetch leaves the app in a disabled error state with a visible recovery message.
- Cards render correctly in each supported mode: `outlines`, `flags`, and `capitals`.
- Flip interactions work through the card surface, the flip button, and keyboard shortcuts.
- Right and wrong grading update scores, toast feedback, history, and progress counters.
- Completing the filtered deck shows the empty-state CTA and allows resetting filtered correct answers.
- Search suggestions rank matches and jumping to a result updates the active card.
- Continent and microstate filters change the active deck and the visible score counts.
- Right and wrong score modals only show entries that match the current filter scope.
- Modal actions can remove a single score entry or clear the filtered list without deleting hidden scores.
- Local data integrity is preserved: cards map to known countries and their SVG assets exist on disk.

### Useful follow-up automation
- Swipe-left and swipe-right touch gestures on a mobile viewport, including threshold and animation behavior.
- Persistence across page reloads for mode, filters, and score state in `localStorage`.
- Search keyboard navigation edge cases such as wraparound, escape-to-close, and empty-result handling.
- Back-navigation behavior after a mix of right and wrong answers across multiple passes.
- Visual regressions for the completion state, score modal, and filter dropdown on narrow screens.

## Implemented Suite

The automated suite added in this change covers the high-value regression paths:
- Mode rendering for a chosen card in outlines, flags, and capitals views.
- Correct-answer scoring plus back-button restoration.
- Keyboard shortcuts for flip and grade, including the completion-state reset flow.
- Filter-scoped wrong-score counts and clear-list behavior.
- Filter-scoped single-item removal from the right-score modal.
- Initial load failure handling.
- Data integrity for `data/cards.json`, `data/countries.json`, and referenced SVG shape assets.

## Residual Risk

The main remaining gaps are touch gesture automation and layout-specific visual assertions. Those are still testable, but they are more brittle than the current deterministic browser and data checks, so they are better added as a second pass once the new baseline suite is stable in CI.
