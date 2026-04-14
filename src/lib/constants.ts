export const ORDINATION_OPTIONS = [
  "Bro",
  "Sis",
  "Exhorter",
  "Deacon",
  "Deaconess",
  "Snr Deacon",
  "Snr Deaconess",
  "Pastor",
  "District Pastor",
  "Elders",
  "Minister",
] as const

export type Ordination = (typeof ORDINATION_OPTIONS)[number]
