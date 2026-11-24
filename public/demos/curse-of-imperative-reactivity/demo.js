// Shared by the demo pages. Stands in for the data a server would render.
const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

window.demoDays = (overrides = {}) =>
  Array.from({ length: 14 }, (_, index) => {
    const id = index + 1
    const fields = { state: "available", start: "", finish: "", ...overrides[id] }
    return { id, week: index < 7 ? 1 : 2, name: NAMES[index % 7], ...fields, saved: { ...fields } }
  })

// A fortnightly pattern where the second Sunday is a night that runs into the first Monday.
window.NIGHT_SEED = {
  1: { state: "specific_times", start: "05:00", finish: "13:00" },
  14: { state: "specific_times", start: "22:00", finish: "06:00" },
}
